
-keepattributes JavascriptInterface
-keepclassmembers class io.github.cmssmc_code.aidevisio.** {
    @android.webkit.JavascriptInterface <methods>;
}

-dontwarn com.google.errorprone.annotations.**
-dontwarn com.google.j2objc.annotations.**
-dontwarn javax.annotation.**
-dontwarn org.checkerframework.**
-dontwarn afu.org.checkerframework.**
-dontwarn org.codehaus.mojo.animal_sniffer.**
