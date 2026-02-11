(function () {
  const token = localStorage.getItem("token");
  const currentPath = window.location.pathname;

  const protectedPaths = ["/view/chat.html", "/chat.html"];
  const authPaths = ["/view/login.html", "/view/signup.html", "/login.html", "/signup.html"];

  const isProtected = protectedPaths.some((p) => currentPath.endsWith(p));
  const isAuthPage = authPaths.some((p) => currentPath.endsWith(p));

  if (isProtected && !token) {
    window.location.href = "/view/login.html";
  } else if (isAuthPage && token) {
    window.location.href = "/view/chat.html";
  }
})();
