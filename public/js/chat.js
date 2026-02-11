(function () {
  const API_BASE = window.location.origin;
  const SOCKET_URL = window.location.origin;

  let socket = null;
  let currentRoom = null;
  let rooms = [];
  let typingTimeout = null;
  const TYPING_DEBOUNCE_MS = 300;
  const TYPING_STOP_MS = 2000;

  const currentUsername = localStorage.getItem("username");

  function init() {
    if (!localStorage.getItem("token")) {
      window.location.href = "login.html";
      return;
    }

    $("#current-user").text("Welcome, " + (currentUsername || "User"));

    loadRooms();
    connectSocket();
    bindEvents();
  }

  async function loadRooms() {
    try {
      const response = await fetch(`${API_BASE}/api/rooms`);
      const data = await response.json();
      rooms = data.rooms || [];
      renderRoomList();
    } catch (err) {
      rooms = ["devops", "cloud computing", "covid19", "sports", "nodeJS", "javascript", "python"];
      renderRoomList();
    }
  }

  function renderRoomList() {
    const $list = $("#room-list");
    $list.empty();
    rooms.forEach((room) => {
      const $item = $("<div>").addClass("room-list-item").data("room", room).text(room);
      $list.append($item);
    });
  }

  function connectSocket() {
    socket = io(SOCKET_URL);

    socket.on("connect", () => {
      socket.emit("authenticate", { token: localStorage.getItem("token") });
    });

    socket.on("authenticated", () => {
      console.log("Socket authenticated");
    });

    socket.on("auth-error", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      window.location.href = "login.html";
    });

    socket.on("previous-messages", ({ messages }) => {
      const $list = $("#messages-list");
      $list.empty();
      messages.forEach((msg) => appendMessage(msg));
    });

    socket.on("new-message", ({ message }) => {
      appendMessage(message);
    });

    socket.on("user-typing", ({ username }) => {
      if (username !== currentUsername) {
        $("#typing-indicator").text(`${username} is typing...`).removeClass("d-none");
      }
    });

    socket.on("user-stopped-typing", ({ username }) => {
      if (username !== currentUsername) {
        $("#typing-indicator").addClass("d-none");
      }
    });

    socket.on("left-room", () => {
      currentRoom = null;
      $("#messages-list").empty();
      $("#no-room-message").removeClass("d-none");
      $("#current-room-display").html('<span class="text-muted">Select a room to start chatting</span>');
      $("#join-room-btn").prop("disabled", false);
      $("#leave-room-btn").prop("disabled", true);
      $("#message-input").prop("disabled", true);
      $("#send-btn").prop("disabled", true);
      $(".room-list-item").removeClass("active");
    });
  }

  function appendMessage(msg) {
    $("#no-room-message").addClass("d-none");
    const isOwn = msg.sender === currentUsername;
    const $bubble = $("<div>").addClass("message-bubble " + (isOwn ? "own" : "other"));
    $bubble.append($("<div>").addClass("message-sender").text(msg.sender));
    $bubble.append($("<div>").addClass("message-content").text(msg.content));
    $bubble.append($("<div>").addClass("message-time").text(new Date(msg.createdAt).toLocaleTimeString()));
    $("#messages-list").append($bubble);
    $("#messages-container").scrollTop($("#messages-container")[0].scrollHeight);
  }

  function bindEvents() {
    $(document).on("click", ".room-list-item", function () {
      $(".room-list-item").removeClass("active");
      $(this).addClass("active");
      $("#join-room-btn").prop("disabled", false);
    });

    $("#join-room-btn").on("click", () => {
      const $selected = $(".room-list-item.active");
      if ($selected.length === 0) return;

      const room = $selected.data("room");
      if (currentRoom) {
        socket.emit("leave-room", { room: currentRoom });
      }

      currentRoom = room;
      socket.emit("join-room", { room });

      $("#current-room-display").html(`<strong>Room: ${room}</strong>`);
      $("#join-room-btn").prop("disabled", true);
      $("#leave-room-btn").prop("disabled", false);
      $("#message-input").prop("disabled", false);
      $("#send-btn").prop("disabled", false);
    });

    $("#leave-room-btn").on("click", () => {
      if (currentRoom) {
        socket.emit("leave-room", { room: currentRoom });
      }
    });

    $("#send-btn").on("click", sendMessage);
    $("#message-input").on("keypress", (e) => {
      if (e.which === 13) sendMessage();
    });

    $("#message-input").on("input", () => {
      if (!currentRoom) return;

      clearTimeout(typingTimeout);
      socket.emit("typing-start", { room: currentRoom });

      typingTimeout = setTimeout(() => {
        socket.emit("typing-stop", { room: currentRoom });
      }, TYPING_STOP_MS);
    });

    $("#message-input").on("blur", () => {
      if (currentRoom) {
        socket.emit("typing-stop", { room: currentRoom });
      }
    });

    $("#logout-btn, #sidebar-logout").on("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      if (socket) socket.disconnect();
      window.location.href = "login.html";
    });
  }

  function sendMessage() {
    const input = $("#message-input");
    const content = input.val().trim();
    if (!content || !currentRoom) return;

    socket.emit("send-message", { room: currentRoom, content });
    input.val("");
    socket.emit("typing-stop", { room: currentRoom });
    $("#typing-indicator").addClass("d-none");
  }

  init();
})();
