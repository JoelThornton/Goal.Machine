package io.github.opportunisticgames.goalmachine;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Instant notifications: the server pushes {id, title, body, link} through Firebase the moment something happens
 *  (your move, a challenge, a result, a new friend). The id is remembered, so the 15-minute check (GameCheckService)
 *  never shows the same thing twice. The device's push token is kept for the site to register (AndroidApp.pushToken). */
public class PushService extends FirebaseMessagingService {

    @Override
    public void onNewToken(String token) {
        saveToken(this, token);
    }

    @Override
    public void onMessageReceived(RemoteMessage msg) {
        Map<String, String> d = msg.getData();
        String id = d.get("id");
        if (id == null || id.isEmpty()) return;
        SharedPreferences p = getSharedPreferences(GameCheckService.PREFS, MODE_PRIVATE);
        Set<String> seen = new HashSet<>(p.getStringSet("seen", new HashSet<>()));
        if (seen.contains(id) || MainActivity.visible || !GameCheckService.allowed(this)) return;  // on screen already, or shown
        seen.add(id);
        p.edit().putStringSet("seen", seen).putLong("lastPush", System.currentTimeMillis()).apply();
        GameCheckService.show(this, id, str(d.get("title"), "Goal Machine"), str(d.get("body"), ""), str(d.get("link"), ""));
    }

    private static String str(String s, String fallback) { return s == null || s.isEmpty() ? fallback : s; }

    static void saveToken(Context ctx, String token) {
        ctx.getSharedPreferences(GameCheckService.PREFS, MODE_PRIVATE).edit().putString("pushToken", token).putString("pushErr", "").apply();
    }

    /** Ask Firebase for this phone's token (it arrives a moment later and is saved). */
    static void fetchToken(Context ctx) {
        try {
            FirebaseMessaging.getInstance().getToken()
                .addOnSuccessListener(t -> saveToken(ctx, t))
                // why not (shown in Settings): usually Google Play services missing, out of date or blocked from the network
                .addOnFailureListener(e -> err(ctx, e.getClass().getSimpleName() + ": " + e.getMessage()));
        } catch (Exception e) { err(ctx, e.getClass().getSimpleName() + ": " + e.getMessage()); }  // the 15-minute check still works
    }

    static void err(Context ctx, String why) {
        ctx.getSharedPreferences(GameCheckService.PREFS, MODE_PRIVATE).edit().putString("pushErr", why == null ? "" : why).apply();
    }

    static String token(Context ctx) {
        return ctx.getSharedPreferences(GameCheckService.PREFS, MODE_PRIVATE).getString("pushToken", "");
    }
}
