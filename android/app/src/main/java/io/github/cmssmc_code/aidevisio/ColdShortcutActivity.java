package io.github.cmssmc_code.aidevisio;

import com.google.androidbrowserhelper.trusted.TwaLauncher;

public class ColdShortcutActivity extends com.google.androidbrowserhelper.trusted.ColdShortcutActivity {
    @Override
    protected TwaLauncher.FallbackStrategy getFallbackStrategy() {
        return WebFallbackActivity.FALLBACK_STRATEGY;
    }
}
