package io.github.opportunisticgames.goalmachine;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Goal Machine for Android: a full-screen WebView around the live site, so the app always has the latest version. */
public class MainActivity extends Activity {
    private static final String HOST = "opportunisticgames.github.io";
    private static final String URL = "https://" + HOST + "/goal-machine/";

    // Shown instead of Android's error page when the site can't be reached (e.g. first launch with no signal)
    private static final String OFFLINE =
        "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
        + "<body style='margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;"
        + "background:#07261d;color:#f4f7f2;font-family:sans-serif;text-align:center;padding:24px;box-sizing:border-box'>"
        + "<div style='font-size:56px'>&#9917;</div><h2 style='margin:12px 0 6px'>No signal in the stadium</h2>"
        + "<p style='opacity:.8;margin:0 0 20px'>Goal Machine needs the internet the first time it opens.</p>"
        + "<button onclick='AndroidApp.retry()' style='background:#c8ff3d;color:#0b3d2e;border:0;border-radius:12px;"
        + "padding:14px 28px;font-size:17px;font-weight:bold'>Try again</button></body></html>";

    private WebView web;
    private String failedUrl = URL;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF07261D);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // scores, album and settings live in localStorage
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) return false;
                openElsewhere(uri);  // anything off-site (e.g. GitHub links) opens in the browser
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                failedUrl = request.getUrl().toString();
                view.loadDataWithBaseURL(null, OFFLINE, "text/html", "utf-8", null);
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidApp");

        String link = siteLink(getIntent());
        if (link != null) web.loadUrl(link);
        else if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(URL);
        setContentView(web);
    }

    /** A Goal Machine link (e.g. a friend's challenge) tapped while the app is already open. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String link = siteLink(intent);
        if (link != null) web.loadUrl(link);
    }

    private static String siteLink(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        return uri != null && HOST.equals(uri.getHost()) ? uri.toString() : null;
    }

    private void openElsewhere(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            // nothing on the phone can open it; stay put
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** What the web app can ask of the phone. Adding methods here needs a new APK, so the site checks they exist first. */
    private class Bridge {
        /** Opens Android's native share sheet. */
        @JavascriptInterface
        public void share(String text) {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(send, "Share"));
        }

        /** The app's build number, so the site can tell players when a newer APK is worth downloading. */
        @JavascriptInterface
        public int version() {
            return BuildConfig.VERSION_CODE;
        }

        /** Reloads the site after the offline screen. */
        @JavascriptInterface
        public void retry() {
            web.post(() -> web.loadUrl(failedUrl));
        }
    }
}
