package io.github.cmssmc_code.aidevisio;

import android.Manifest;
import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.util.Base64;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.google.androidbrowserhelper.trusted.TwaLauncher;

import org.json.JSONObject;

import java.io.OutputStream;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

public class WebFallbackActivity extends Activity {
    private static final String TAG = "Aide Visio";
    private static final String EXTRA_URL = "io.github.cmssmc_code.aidevisio.EXTRA_URL";
    private static final String STATE_URL = "aidevisio.url";
    private static final String BRIDGE = "AideVisioAndroid";
    private static final int REQUEST_FILES = 101;
    private static final int REQUEST_SAVE = 102;
    private static final int REQUEST_MIC = 103;

    static final TwaLauncher.FallbackStrategy FALLBACK_STRATEGY =
            (context, builder, providerPackage, completionCallback) -> {
                Intent intent = new Intent(context, WebFallbackActivity.class)
                        .putExtra(EXTRA_URL, builder.getUri().toString())
                        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                if (!(context instanceof Activity)) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                if (completionCallback != null) completionCallback.run();
            };

    private static final String SHIM = """
            (function () {
              'use strict';
              if (window.__aidevisioAndroid) return;
              window.__aidevisioAndroid = true;
              var A = window.AideVisioAndroid;
              if (!A) return;

              if (!('wakeLock' in navigator)) {
                var active = [];
                var sync = function () { A.keepScreenOn(active.length > 0); };
                var Sentinel = function () { this.type = 'screen'; this.released = false; this.onrelease = null; this._l = []; };
                Sentinel.prototype.addEventListener = function (t, f) { if (t === 'release' && typeof f === 'function') this._l.push(f); };
                Sentinel.prototype.removeEventListener = function (t, f) { this._l = this._l.filter(function (g) { return g !== f; }); };
                Sentinel.prototype.release = function () {
                  if (this.released) return Promise.resolve();
                  this.released = true;
                  var self = this;
                  active = active.filter(function (s) { return s !== self; });
                  sync();
                  var ev = { type: 'release', target: this };
                  try { if (typeof this.onrelease === 'function') this.onrelease(ev); } catch (e) {}
                  this._l.forEach(function (f) { try { f(ev); } catch (e) {} });
                  return Promise.resolve();
                };
                var wakeLock = {
                  request: function () {
                    if (document.visibilityState !== 'visible') {
                      return Promise.reject(new DOMException('Page non visible', 'NotAllowedError'));
                    }
                    var s = new Sentinel();
                    active.push(s);
                    sync();
                    return Promise.resolve(s);
                  }
                };
                try { Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true }); } catch (e) {}
                document.addEventListener('visibilitychange', function () {
                  if (document.visibilityState !== 'visible') active.slice().forEach(function (s) { s.release(); });
                });
              }

              window.open = function (url) {
                var u = null;
                try { u = url ? new URL(String(url), location.href) : null; } catch (e) { u = null; }
                if (u && (u.protocol === 'https:' || u.protocol === 'http:') && u.origin !== location.origin) {
                  A.openExternal(u.href);
                }
                return null;
              };

              var save = function (href, name) {
                fetch(href).then(function (r) { return r.blob(); }).then(function (blob) {
                  var reader = new FileReader();
                  reader.onload = function () {
                    var s = String(reader.result || ''), i = s.indexOf(',');
                    A.saveFile(name || 'aidevisio', blob.type || 'application/octet-stream', i >= 0 ? s.slice(i + 1) : '');
                  };
                  reader.readAsDataURL(blob);
                }).catch(function (e) { console.warn('[Aide Visio] export impossible', e); });
              };
              var isDownload = function (a) {
                return !!(a && a.hasAttribute && a.hasAttribute('download') && /^(blob|data):/i.test(a.href || ''));
              };
              var nativeClick = HTMLAnchorElement.prototype.click;
              HTMLAnchorElement.prototype.click = function () {
                if (isDownload(this)) { save(this.href, this.getAttribute('download')); return; }
                return nativeClick.apply(this, arguments);
              };
              document.addEventListener('click', function (e) {
                var a = e.target && e.target.closest ? e.target.closest('a') : null;
                if (isDownload(a)) { e.preventDefault(); save(a.href, a.getAttribute('download')); }
              }, true);
            })();
            """;

    private FrameLayout root;
    private WebView webView;
    private Uri appOrigin;
    private String launchUrl;
    private boolean documentStartScript;
    private ValueCallback<Uri[]> pendingFiles;
    private PermissionRequest pendingPermission;
    private byte[] pendingSave;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        launchUrl = getString(R.string.launchUrl);
        appOrigin = Uri.parse(getString(R.string.appOrigin));

        styleSystemBars();
        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.backgroundColor));
        root.setOnApplyWindowInsetsListener(WebFallbackActivity::applyInsets);
        setContentView(root);

        if (Build.VERSION.SDK_INT >= 33) Api33.registerBack(this);
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        if (!createWebView()) {
            showNoWebView();
            return;
        }
        String url = savedInstanceState != null ? savedInstanceState.getString(STATE_URL) : null;
        if (!isAppUrl(url)) url = getIntent().getStringExtra(EXTRA_URL);
        webView.loadUrl(isAppUrl(url) ? url : launchUrl);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String url = intent.getStringExtra(EXTRA_URL);
        if (webView == null || !isAppUrl(url)) return;
        String current = webView.getUrl();
        if (!isAppUrl(current)) {
            webView.loadUrl(url);
            return;
        }
        // Simple ouverture de l'icône : on garde la page en cours.
        if (sameUrl(url, launchUrl) || sameUrl(url, current)) return;
        String target = withoutFragment(url);
        String fragment = Uri.parse(url).getFragment();
        if (target.equals(withoutFragment(current)) && fragment != null && !fragment.isEmpty()) {
            // Seul le fragment change : navigation par ancre, sans rechargement (hashchange).
            webView.evaluateJavascript("location.hash=" + JSONObject.quote("#" + fragment), null);
        } else {
            webView.loadUrl(url);
        }
    }

    private static String withoutFragment(String url) {
        int i = url.indexOf('#');
        String base = i >= 0 ? url.substring(0, i) : url;
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private static boolean sameUrl(String a, String b) {
        if (a == null || b == null) return false;
        String fa = Uri.parse(a).getFragment(), fb = Uri.parse(b).getFragment();
        fa = fa == null || fa.equals("/") ? "" : fa;
        fb = fb == null || fb.equals("/") ? "" : fb;
        return withoutFragment(a).equals(withoutFragment(b)) && fa.equals(fb);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null && isAppUrl(webView.getUrl())) outState.putString(STATE_URL, webView.getUrl());
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        styleSystemBars();
        int bg = getColor(R.color.backgroundColor);
        root.setBackgroundColor(bg);
        if (webView != null) webView.setBackgroundColor(bg);
    }

    @Override
    protected void onDestroy() {
        if (pendingFiles != null) {
            pendingFiles.onReceiveValue(null);
            pendingFiles = null;
        }
        if (pendingPermission != null) {
            pendingPermission.deny();
            pendingPermission = null;
        }
        if (webView != null) {
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        goBack();
    }

    private void goBack() {
        if (webView != null && isAppUrl(webView.getUrl()) && webView.canGoBack()) {
            webView.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    private boolean createWebView() {
        WebView view;
        try {
            view = new WebView(this);
        } catch (Throwable t) {
            Log.e(TAG, "WebView indisponible", t);
            return false;
        }
        view.setBackgroundColor(getColor(R.color.backgroundColor));

        WebSettings s = view.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setBuiltInZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + " AideVisioAndroid");
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);

        view.setWebViewClient(new Client());
        view.setWebChromeClient(new ChromeClient());
        view.addJavascriptInterface(new Bridge(), BRIDGE);

        documentStartScript = false;
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try {
                Set<String> rules = Collections.singleton(getString(R.string.appOrigin));
                WebViewCompat.addDocumentStartJavaScript(view, SHIM, rules);
                documentStartScript = true;
            } catch (RuntimeException e) {
                Log.w(TAG, "Script de démarrage non injecté", e);
            }
        }

        root.addView(view, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView = view;
        return true;
    }

    private final class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isAppOrigin(uri)) return false;
            if (!request.isForMainFrame()) return false;
            openExternally(uri);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (!documentStartScript && isAppUrl(url)) view.evaluateJavascript(SHIM, null);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (!documentStartScript && isAppUrl(url)) view.evaluateJavascript(SHIM, null);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                Log.w(TAG, "Chargement impossible : " + error.getDescription());
                showOffline();
            }
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            boolean crashed = Build.VERSION.SDK_INT >= 26 && detail.didCrash();
            Log.w(TAG, "Moteur de rendu arrêté (crash=" + crashed + "), rechargement");
            String url = view.getUrl();
            root.removeView(view);
            view.destroy();
            if (view == webView) webView = null;
            // Les verrous d'écran du JS sont perdus avec le moteur de rendu.
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (createWebView()) {
                webView.loadUrl(isAppUrl(url) ? url : launchUrl);
            } else {
                showNoWebView();
            }
            return true;
        }
    }

    private final class ChromeClient extends WebChromeClient {
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> handlePermission(request));
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest request) {
            if (pendingPermission == request) pendingPermission = null;
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            return showFileChooser(callback, params);
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture,
                                      Message resultMsg) {
            WebView.HitTestResult hit = view.getHitTestResult();
            if (isUserGesture && hit != null && hit.getType() == WebView.HitTestResult.SRC_ANCHOR_TYPE
                    && hit.getExtra() != null) {
                openExternally(Uri.parse(hit.getExtra()));
            }
            return false;
        }
    }

    private final class Bridge {
        @JavascriptInterface
        public void keepScreenOn(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void openExternal(String url) {
            if (url == null) return;
            runOnUiThread(() -> openExternally(Uri.parse(url)));
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            runOnUiThread(() -> startSave(name, mime, base64));
        }
    }

    private void handlePermission(PermissionRequest request) {
        boolean audio = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) audio = true;
        }
        if (!audio || !isAppOrigin(request.getOrigin())) {
            request.deny();
            return;
        }
        String[] grant = {PermissionRequest.RESOURCE_AUDIO_CAPTURE};
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(grant);
            return;
        }
        if (pendingPermission != null) pendingPermission.deny();
        pendingPermission = request;
        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_MIC);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != REQUEST_MIC || pendingPermission == null) return;
        PermissionRequest request = pendingPermission;
        pendingPermission = null;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            request.deny();
            toast(R.string.micDenied);
        }
    }

    private boolean showFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (pendingFiles != null) pendingFiles.onReceiveValue(null);
        pendingFiles = callback;
        Intent pick = new Intent(Intent.ACTION_GET_CONTENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("*/*");
        String[] mimes = mimeTypes(params.getAcceptTypes());
        if (mimes.length > 0) pick.putExtra(Intent.EXTRA_MIME_TYPES, mimes);
        if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
            pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }
        try {
            startActivityForResult(pick, REQUEST_FILES);
        } catch (ActivityNotFoundException e) {
            pendingFiles = null;
            callback.onReceiveValue(null);
            toast(R.string.noFilePicker);
        }
        return true;
    }

    private static String[] mimeTypes(String[] accept) {
        Set<String> out = new LinkedHashSet<>();
        if (accept != null) {
            for (String entry : accept) {
                if (entry == null) continue;
                for (String raw : entry.split(",")) {
                    String t = raw.trim().toLowerCase(Locale.ROOT);
                    if (t.isEmpty()) continue;
                    if (t.contains("/")) {
                        out.add(t);
                        continue;
                    }
                    if (t.startsWith(".")) t = t.substring(1);
                    String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(t);
                    if (mime != null) out.add(mime);
                    if (t.equals("md") || t.equals("markdown")) out.add("text/markdown");
                }
            }
        }
        if (out.isEmpty() || out.contains("*/*")) return new String[0];
        out.add("text/*");
        out.add("application/octet-stream");
        return out.toArray(new String[0]);
    }

    private static Uri[] pickedUris(Intent data) {
        if (data == null) return null;
        ClipData clip = data.getClipData();
        if (clip != null && clip.getItemCount() > 0) {
            Uri[] uris = new Uri[clip.getItemCount()];
            for (int i = 0; i < uris.length; i++) uris[i] = clip.getItemAt(i).getUri();
            return uris;
        }
        Uri single = data.getData();
        return single == null ? null : new Uri[]{single};
    }

    private void startSave(String name, String mime, String base64) {
        byte[] bytes;
        try {
            bytes = Base64.decode(base64 == null ? "" : base64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            toast(R.string.fileSaveFailed);
            return;
        }
        String type = mime == null ? "" : mime.split(";")[0].trim();
        if (!type.contains("/")) type = "application/octet-stream";
        Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(type)
                .putExtra(Intent.EXTRA_TITLE, safeFileName(name));
        pendingSave = bytes;
        try {
            startActivityForResult(create, REQUEST_SAVE);
        } catch (ActivityNotFoundException e) {
            pendingSave = null;
            toast(R.string.fileSaveFailed);
        }
    }

    private static String safeFileName(String name) {
        String n = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        return n.isEmpty() ? "aidevisio" : n;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_FILES) {
            ValueCallback<Uri[]> callback = pendingFiles;
            pendingFiles = null;
            if (callback != null) callback.onReceiveValue(resultCode == RESULT_OK ? pickedUris(data) : null);
        } else if (requestCode == REQUEST_SAVE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                if (out == null) throw new java.io.IOException("flux nul");
                out.write(bytes);
                toast(R.string.fileSaved);
            } catch (Exception e) {
                Log.w(TAG, "Enregistrement impossible", e);
                toast(R.string.fileSaveFailed);
            }
        }
    }

    private void openExternally(Uri uri) {
        if (uri == null) return;
        if (isAppOrigin(uri)) {
            if (webView != null) webView.loadUrl(uri.toString());
            return;
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("https") && !scheme.equals("http") && !scheme.equals("mailto") && !scheme.equals("tel")) {
            return;
        }
        Intent view = new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            startActivity(view);
        } catch (ActivityNotFoundException e) {
            toast(R.string.noAppForLink);
        }
    }

    private boolean isAppOrigin(Uri uri) {
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && uri.getHost() != null
                && uri.getHost().equalsIgnoreCase(appOrigin.getHost())
                && uri.getPort() == appOrigin.getPort();
    }

    private boolean isAppUrl(String url) {
        return url != null && isAppOrigin(Uri.parse(url));
    }

    private boolean isNight() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
    }

    @SuppressWarnings("deprecation")
    private void styleSystemBars() {
        Window window = getWindow();
        boolean light = !isNight();
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(light ? mask : 0, mask);
            }
        } else {
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
            if (light) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 26) {
                flags |= View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                if (light) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            window.getDecorView().setSystemUiVisibility(flags);
        }
        if (Build.VERSION.SDK_INT < 35) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Build.VERSION.SDK_INT >= 26 ? Color.TRANSPARENT : Color.BLACK);
        }
        if (Build.VERSION.SDK_INT >= 29) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
    }

    @SuppressWarnings("deprecation")
    private static WindowInsets applyInsets(View v, WindowInsets insets) {
        if (Build.VERSION.SDK_INT >= 30) {
            Insets i = insets.getInsets(WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsets.CONSUMED;
        }
        v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
        return insets.consumeSystemWindowInsets();
    }

    private void showOffline() {
        if (webView == null) return;
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        String html ="<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<style>:root{color-scheme:light dark}"
                + "body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;"
                + "font:17px/1.45 -apple-system,system-ui,'Segoe UI',Roboto,sans-serif;background:#f2f2f7;color:#1d1d1f;text-align:center}"
                + "@media (prefers-color-scheme:dark){body{background:#000;color:#f5f5f7}}"
                + "main{padding:32px;max-width:420px}h1{font-size:28px;letter-spacing:-.02em;margin:0 0 12px}"
                + "p{opacity:.72;margin:0}a{display:inline-block;margin-top:24px;padding:14px 30px;border-radius:999px;"
                + "background:#0071e3;color:#fff;text-decoration:none;font-weight:600}</style></head><body><main>"
                + "<h1>" + escapeHtml(getString(R.string.offlineTitle)) + "</h1>"
                + "<p>" + escapeHtml(getString(R.string.offlineText)) + "</p>"
                + "<a href=\"" + escapeHtml(launchUrl) + "\">" + escapeHtml(getString(R.string.offlineRetry)) + "</a>"
                + "</main></body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }

    private void showNoWebView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        int pad = dp(32);
        box.setPadding(pad, pad, pad, pad);

        TextView text = new TextView(this);
        text.setText(R.string.noWebView);
        text.setGravity(Gravity.CENTER);
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        text.setTextColor(isNight() ? 0xFFF5F5F7 : 0xFF1D1D1F);
        box.addView(text);

        Button install = new Button(this);
        install.setText(R.string.installChrome);
        install.setOnClickListener(v -> openStore("com.android.chrome"));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(24);
        box.addView(install, lp);

        root.removeAllViews();
        root.addView(box, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void openStore(String pkg) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg)));
        } catch (ActivityNotFoundException e) {
            openExternally(Uri.parse("https://play.google.com/store/apps/details?id=" + pkg));
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void toast(int message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private static String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    @TargetApi(33)
    private static final class Api33 {
        static void registerBack(WebFallbackActivity activity) {
            activity.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, activity::goBack);
        }
    }
}
