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

/** Every ~15 minutes, asks the game server whether any online games are waiting on this player (a new challenge or
 *  their pick) and shows a notification for each new one. Tapping it opens that game. */
public class GameCheckService extends JobService {
    private static final int JOB_ID = 4242;
    private static final String CHANNEL = "your_move";
    static final String PREFS = "online";

    /** Remembers who to check for and makes sure the periodic check is scheduled. */
    static void watch(Context ctx, String user, String url, String key) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
        p.edit().putString("user", user).putString("url", url).putString("key", key).apply();
        JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null || js.getPendingJob(JOB_ID) != null) return;
        js.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(ctx, GameCheckService.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPeriodic(15 * 60 * 1000L)
            .setPersisted(false)
            .build());
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try { check(this); } catch (Exception e) { /* try again next time */ }
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    static void check(Context ctx) throws Exception {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
        String user = p.getString("user", ""), url = p.getString("url", ""), key = p.getString("key", "");
        if (user.isEmpty() || !url.startsWith("https://")) return;
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) return;
        HttpURLConnection c = (HttpURLConnection) new URL(url + "/rest/v1/rpc/online_waiting").openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("apikey", key);
        if (key.startsWith("eyJ")) c.setRequestProperty("Authorization", "Bearer " + key);
        try (OutputStream o = c.getOutputStream()) {
            o.write(new JSONObject().put("p_user", user).toString().getBytes(StandardCharsets.UTF_8));
        }
        if (c.getResponseCode() != 200) return;
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        try (InputStream in = c.getInputStream()) {
            byte[] b = new byte[4096];
            for (int n; (n = in.read(b)) > 0; ) buf.write(b, 0, n);
        }
        JSONArray games = new JSONArray(buf.toString("UTF-8"));
        // notify once per waiting turn: the game code plus when it last changed
        Set<String> seen = new HashSet<>(p.getStringSet("seen", new HashSet<>())), now = new HashSet<>();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Your move", NotificationManager.IMPORTANCE_DEFAULT));
        }
        for (int i = 0; i < games.length(); i++) {
            JSONObject g = games.getJSONObject(i);
            String code = g.optString("code"), id = code + "@" + g.optLong("updated");
            now.add(id);
            if (seen.contains(id)) continue;
            String opp = g.optString("opp", "Someone"), kind = "duel".equals(g.optString("kind")) ? "Draft Duel" : "Live Race";
            Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("https://opportunisticgames.github.io/goal-machine/#/online?room=" + code), ctx, MainActivity.class);
            PendingIntent pi = PendingIntent.getActivity(ctx, code.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification.Builder nb = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
            nb.setSmallIcon(R.drawable.ic_stat_ball)
                .setContentTitle("⚔️ Your move against " + opp)
                .setContentText("duel".equals(g.optString("kind")) ? "It's your pick in your Draft Duel" : "Build your XI in your Live Race")
                .setContentIntent(pi)
                .setAutoCancel(true);
            nm.notify(code.hashCode(), nb.build());
        }
        p.edit().putStringSet("seen", now).apply();
    }
}
