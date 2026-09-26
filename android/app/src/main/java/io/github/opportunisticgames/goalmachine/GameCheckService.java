package io.github.opportunisticgames.goalmachine;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/** Every ~15 minutes, asks the game server what this player should be told about and shows a notification (with a
 *  referee's whistle) for each new item. The server decides everything - which function to call, the title, text and
 *  the link a tap opens - so new kinds of notification never need a new APK. Tapping one opens that page in the app. */
public class GameCheckService extends JobService {
    private static final int JOB_ID = 4243, OLD_JOB_ID = 4242;  // 4243: persisted across restarts (build 16+)
    private static final String CHANNEL = "moves_whistle";
    static final String PREFS = "online";

    /** Remembers what to ask the server ({url, key, rpc, args}) and makes sure the periodic check is scheduled. */
    static void configure(Context ctx, String configJson) {
        ctx.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("config", configJson).apply();
        ensureScheduled(ctx);
    }

    /** Schedules the 15-minute check if Android has dropped it (a force stop, a battery saver, a failed schedule).
     *  Called whenever the app opens, and what happened is saved for the Settings page. */
    static void ensureScheduled(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
        if (p.getString("config", "").isEmpty()) return;
        String result;
        try {
            JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (js == null) result = "no job scheduler";
            else {
                js.cancel(OLD_JOB_ID);
                if (js.getPendingJob(JOB_ID) != null) return;  // already scheduled: nothing to do
                int r;
                try { r = js.schedule(job(ctx, true)); }
                // belt and braces: if the phone still won't allow a network condition, check anyway (a check with no
                // connection just fails quietly and tries again 15 minutes later)
                catch (SecurityException e) { r = js.schedule(job(ctx, false)); }
                result = r == JobScheduler.RESULT_SUCCESS ? "scheduled" : "Android refused the schedule";
            }
        } catch (Exception e) { result = "schedule error: " + e.getClass().getSimpleName() + " " + e.getMessage(); }
        p.edit().putString("sched", result).putLong("schedAt", System.currentTimeMillis()).apply();
    }

    private static JobInfo job(Context ctx, boolean needNetwork) {
        JobInfo.Builder b = new JobInfo.Builder(JOB_ID, new ComponentName(ctx, GameCheckService.class))
            .setPeriodic(15 * 60 * 1000L)
            .setPersisted(true);  // survives a phone restart (RECEIVE_BOOT_COMPLETED)
        if (needNetwork) b.setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY);
        return b.build();
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putLong("lastJob", System.currentTimeMillis()).apply();
        new Thread(() -> {
            try { check(this, false); } catch (Exception e) { note(this, "error: " + e.getClass().getSimpleName() + " " + e.getMessage(), -1); }
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    static void channel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Your move", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Challenges, your turn in online games and results");
        ch.setSound(whistle(ctx), new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[] { 0, 120, 80, 260 });
        nm.createNotificationChannel(ch);
    }

    static Uri whistle(Context ctx) {
        return Uri.parse("android.resource://" + ctx.getPackageName() + "/" + R.raw.whistle);
    }

    /** What the last check did, for the game's Settings page ("checked 4 minutes ago, 2 waiting"). */
    static void note(Context ctx, String result, int count) {
        ctx.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putLong("lastRun", System.currentTimeMillis())
            .putString("lastResult", result).putInt("lastCount", count).apply();
    }

    static boolean allowed(Context ctx) {
        return Build.VERSION.SDK_INT < 33 || ctx.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    static String status(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
        JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            return new JSONObject().put("allowed", allowed(ctx)).put("enabled", nm.areNotificationsEnabled())
                .put("scheduled", js != null && js.getPendingJob(JOB_ID) != null).put("configured", !p.getString("config", "").isEmpty())
                .put("lastRun", p.getLong("lastRun", 0)).put("lastResult", p.getString("lastResult", "")).put("lastCount", p.getInt("lastCount", -1))
                // why checks might not run: the last schedule attempt, the last time Android ran the check in the
                // background, whether the phone restricts the app's battery use, and its standby bucket
                // (10 active, 20 working set, 30 frequent, 40 rare, 45 restricted: rarer buckets run less often)
                .put("sched", p.getString("sched", "")).put("schedAt", p.getLong("schedAt", 0)).put("lastJob", p.getLong("lastJob", 0))
                .put("restricted", Build.VERSION.SDK_INT >= 28 && ((android.app.ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE)).isBackgroundRestricted())
                .put("bucket", Build.VERSION.SDK_INT >= 28 ? ((android.app.usage.UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE)).getAppStandbyBucket() : 0)
                .toString();
        } catch (Exception e) { return "{}"; }
    }

    /** A sample notification, so players can check sound and permission. */
    static void test(Context ctx) {
        channel(ctx);
        Intent open = new Intent(ctx, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(ctx, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder nb = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        nb.setSmallIcon(R.drawable.ic_stat_ball).setColor(0xFF16803C).setContentTitle("⚽ Goal Machine notifications work!")
            .setContentText("You'll hear this whistle when it's your move.").setContentIntent(pi).setAutoCancel(true);
        if (Build.VERSION.SDK_INT < 26) nb.setSound(whistle(ctx)).setVibrate(new long[] { 0, 120, 80, 260 }).setPriority(Notification.PRIORITY_HIGH);
        ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).notify(1, nb.build());
    }

    /** force = "check now" from Settings: notify even while the game is open. */
    static void check(Context ctx, boolean force) throws Exception {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
        JSONObject cfg = new JSONObject(p.getString("config", "{}"));
        String url = cfg.optString("url"), key = cfg.optString("key"), rpc = cfg.optString("rpc", "app_inbox");
        if (!url.startsWith("https://") || !rpc.matches("[a-z_]+")) { note(ctx, "not set up (open the Online tab)", -1); return; }
        if (!allowed(ctx)) { note(ctx, "no permission", -1); return; }
        HttpURLConnection c = (HttpURLConnection) new URL(url + "/rest/v1/rpc/" + rpc).openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("apikey", key);
        if (key.startsWith("eyJ")) c.setRequestProperty("Authorization", "Bearer " + key);
        try (OutputStream o = c.getOutputStream()) {
            o.write(cfg.optJSONObject("args") != null ? cfg.getJSONObject("args").toString().getBytes(StandardCharsets.UTF_8) : "{}".getBytes(StandardCharsets.UTF_8));
        }
        if (c.getResponseCode() != 200) { note(ctx, "server said " + c.getResponseCode(), -1); return; }
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        try (InputStream in = c.getInputStream()) {
            byte[] b = new byte[4096];
            for (int n; (n = in.read(b)) > 0; ) buf.write(b, 0, n);
        }
        JSONArray items = new JSONArray(buf.toString("UTF-8"));
        // each item is shown once (by id). While the game is on screen nothing is shown, and nothing is marked as seen
        // either, so it still arrives once you've closed the app (build 15 marked it seen, so it never came)
        Set<String> seen = new HashSet<>(p.getStringSet("seen", new HashSet<>())), now = new HashSet<>();
        boolean quiet = MainActivity.visible && !force;
        int shown = 0;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        channel(ctx);
        for (int i = 0; i < items.length(); i++) {
            JSONObject g = items.getJSONObject(i);
            String id = g.optString("id");
            if (quiet) { if (seen.contains(id)) now.add(id); continue; }
            now.add(id);
            if (seen.contains(id)) continue;
            shown++;
            String link = g.optString("link", "https://opportunisticgames.github.io/goal-machine/");
            Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(link), ctx, MainActivity.class);
            PendingIntent pi = PendingIntent.getActivity(ctx, id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification.Builder nb = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
            nb.setSmallIcon(R.drawable.ic_stat_ball)
                .setColor(0xFF16803C)
                .setContentTitle(g.optString("title", "Goal Machine"))
                .setContentText(g.optString("body", ""))
                .setContentIntent(pi)
                .setAutoCancel(true);
            if (Build.VERSION.SDK_INT < 26) nb.setSound(whistle(ctx)).setVibrate(new long[] { 0, 120, 80, 260 }).setPriority(Notification.PRIORITY_HIGH);
            nm.notify(id.hashCode(), nb.build());
        }
        p.edit().putStringSet("seen", now).apply();
        note(ctx, "ok" + (quiet ? " (game open, so saved for later)" : shown > 0 ? ", showed " + shown : ""), items.length());
    }
}
