package com.cronociclo.app;

import android.app.PictureInPictureParams;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private volatile boolean isTimerRunning = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new PipJsBridge(), "CronocicloNative");
        }
    }

    public class PipJsBridge {
        @JavascriptInterface
        public void setTimerRunning(final boolean running) {
            isTimerRunning = running;
            runOnUiThread(() -> updatePipParams());
        }
    }

    private PictureInPictureParams buildPipParams() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(1, 1));

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(isTimerRunning);
                builder.setSeamlessResizeEnabled(true);
            }
            return builder.build();
        }
        return null;
    }

    private void updatePipParams() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                PictureInPictureParams params = buildPipParams();
                if (params != null) {
                    setPictureInPictureParams(params);
                }
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (isTimerRunning && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!isInPictureInPictureMode()) {
                try {
                    PictureInPictureParams params = buildPipParams();
                    if (params != null) {
                        enterPictureInPictureMode(params);
                    }
                } catch (Exception ignored) {
                }
            }
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Mantém o WebView renderizando normalmente quando está visível na janela flutuante (PiP)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode()) {
            keepWebViewActive();
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            if (isInPictureInPictureMode) {
                keepWebViewActive();
            }
            final String js = "window.dispatchEvent(new CustomEvent('cronociclo:pip', { detail: { active: "
                + isInPictureInPictureMode + " } }));";
            webView.post(() -> webView.evaluateJavascript(js, null));
        }
    }

    private void keepWebViewActive() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.onResume();
            webView.resumeTimers();
        }
    }
}
