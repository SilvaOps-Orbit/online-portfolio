const target = document.getElementById("react-api-status-root");
let loaded = false;

async function loadWidget() {
  if (!target || loaded) return;
  loaded = true;
  try {
    const { mountApiStatusWidget } = await import("./ApiStatusWidget");
    mountApiStatusWidget(target);
  } catch (error) {
    console.error("React island could not be loaded", error);
    target.innerHTML = '<div class="react-api-status-fallback is-error" role="status">Integration status is temporarily unavailable. The static portfolio is still working.</div>';
  }
}

if (target) {
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void loadWidget();
    }, { rootMargin: "500px 0px" });
    observer.observe(target);
  } else {
    void loadWidget();
  }
}
