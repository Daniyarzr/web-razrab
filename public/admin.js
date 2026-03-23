const loginSection = document.getElementById("loginSection");
const panelSection = document.getElementById("panelSection");
const loginMsg = document.getElementById("loginMsg");
const saveMsg = document.getElementById("saveMsg");

let state = null;
let currentAvatarPath = "";
let currentProjectImages = [];

const byId = (id) => document.getElementById(id);
const defaultProjectImage = "/uploads/default-project-1.svg";

const normalizeImages = (item) => {
  if (Array.isArray(item?.images) && item.images.length) {
    return item.images.filter(Boolean);
  }
  if (item?.image) {
    return [item.image];
  }
  return [];
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      ...(options.headers || {})
    },
    ...options
  });

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || "Ошибка запроса");
  }

  return payload;
}

async function uploadSingle(inputEl) {
  if (!inputEl.files || !inputEl.files[0]) {
    throw new Error("Выберите файл");
  }

  const form = new FormData();
  form.append("image", inputEl.files[0]);

  const data = await request("/api/admin/upload", {
    method: "POST",
    body: form
  });

  return data.path;
}

async function uploadMultiple(inputEl) {
  if (!inputEl.files || !inputEl.files.length) {
    return [];
  }

  const form = new FormData();
  Array.from(inputEl.files).forEach((file) => form.append("images", file));

  const data = await request("/api/admin/uploads", {
    method: "POST",
    body: form
  });

  return Array.isArray(data.paths) ? data.paths : [];
}

function renderPendingProjectImages() {
  const wrap = byId("pendingProjectImages");
  wrap.innerHTML = "";

  currentProjectImages.forEach((path, index) => {
    const box = document.createElement("div");
    box.className = "thumb";

    const img = document.createElement("img");
    img.src = path;
    img.alt = `Фото ${index + 1}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "x";
    removeBtn.onclick = () => {
      currentProjectImages = currentProjectImages.filter((_, i) => i !== index);
      renderPendingProjectImages();
    };

    box.appendChild(img);
    box.appendChild(removeBtn);
    wrap.appendChild(box);
  });
}

function fillForm() {
  if (!state) return;

  byId("heroName").value = state.hero?.name || "";
  byId("heroTitle").value = state.hero?.title || "";
  byId("heroSubtitle").value = state.hero?.subtitle || "";

  currentAvatarPath = state.hero?.avatar || "";
  byId("avatarPath").textContent = currentAvatarPath;

  byId("aboutHeading").value = state.about?.heading || "";
  byId("aboutText").value = state.about?.text || "";

  byId("servicesText").value = (state.services || []).join("\n");

  byId("contactTelegram").value = state.contacts?.telegram || "";
  byId("contactEmail").value = state.contacts?.email || "";
  byId("contactPhone").value = state.contacts?.phone || "";

  renderPortfolioItems();
}

function createImageThumb(path, onRemove) {
  const box = document.createElement("div");
  box.className = "thumb";

  const img = document.createElement("img");
  img.src = path || defaultProjectImage;
  img.alt = "Фото проекта";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "x";
  removeBtn.onclick = onRemove;

  box.appendChild(img);
  box.appendChild(removeBtn);

  return box;
}

function renderPortfolioItems() {
  const wrap = byId("portfolioItems");
  wrap.innerHTML = "";

  (state?.portfolio || []).forEach((item) => {
    const images = normalizeImages(item);

    const box = document.createElement("div");
    box.className = "item";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const desc = document.createElement("p");
    desc.textContent = item.description;

    const link = document.createElement("p");
    link.textContent = item.link ? `Ссылка: ${item.link}` : "Ссылка: не указана";

    const imagesInfo = document.createElement("p");
    imagesInfo.textContent = `Фото в проекте: ${images.length}`;

    const gallery = document.createElement("div");
    gallery.className = "item-gallery";

    images.forEach((imgPath, imageIndex) => {
      gallery.appendChild(
        createImageThumb(imgPath, async () => {
          const nextImages = images.filter((_, idx) => idx !== imageIndex);
          const data = await request(`/api/admin/portfolio/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: nextImages })
          });

          const itemIndex = state.portfolio.findIndex((x) => x.id === item.id);
          state.portfolio[itemIndex] = data.item;
          renderPortfolioItems();
        })
      );
    });

    const addInput = document.createElement("input");
    addInput.type = "file";
    addInput.accept = "image/*";
    addInput.multiple = true;

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "Добавить фото";
    addBtn.onclick = async () => {
      const uploaded = await uploadMultiple(addInput);
      if (!uploaded.length) return;

      const data = await request(`/api/admin/portfolio/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [...images, ...uploaded] })
      });

      const itemIndex = state.portfolio.findIndex((x) => x.id === item.id);
      state.portfolio[itemIndex] = data.item;
      renderPortfolioItems();
    };

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "delete-btn";
    removeBtn.textContent = "Удалить проект";
    removeBtn.onclick = async () => {
      await request(`/api/admin/portfolio/${item.id}`, { method: "DELETE" });
      state.portfolio = state.portfolio.filter((x) => x.id !== item.id);
      renderPortfolioItems();
    };

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.appendChild(addInput);
    actions.appendChild(addBtn);
    actions.appendChild(removeBtn);

    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(link);
    box.appendChild(imagesInfo);
    box.appendChild(gallery);
    box.appendChild(actions);
    wrap.appendChild(box);
  });
}

async function loadContent() {
  state = await request("/api/content");
  fillForm();
}

function showPanel(authenticated) {
  loginSection.classList.toggle("hidden", authenticated);
  panelSection.classList.toggle("hidden", !authenticated);
}

async function checkSession() {
  const session = await request("/api/admin/session");
  showPanel(session.authenticated);
  if (session.authenticated) {
    await loadContent();
  }
}

byId("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "";

  try {
    await request("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: byId("password").value.trim() })
    });

    byId("password").value = "";
    showPanel(true);
    await loadContent();
  } catch (err) {
    loginMsg.textContent = err.message;
  }
});

byId("logoutBtn").addEventListener("click", async () => {
  await request("/api/admin/logout", { method: "POST" });
  showPanel(false);
});

byId("uploadAvatarBtn").addEventListener("click", async () => {
  try {
    const path = await uploadSingle(byId("avatarFile"));
    currentAvatarPath = path;
    byId("avatarPath").textContent = path;
    byId("avatarFile").value = "";
  } catch (err) {
    byId("avatarPath").textContent = err.message;
  }
});

byId("uploadProjectBtn").addEventListener("click", async () => {
  try {
    const uploaded = await uploadMultiple(byId("projectFiles"));
    currentProjectImages = [...currentProjectImages, ...uploaded];
    byId("projectPath").textContent = uploaded.length
      ? `Загружено: ${uploaded.length} файл(ов)`
      : "Выберите фото";
    byId("projectFiles").value = "";
    renderPendingProjectImages();
  } catch (err) {
    byId("projectPath").textContent = err.message;
  }
});

byId("contentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  saveMsg.textContent = "";

  try {
    if (byId("avatarFile").files && byId("avatarFile").files[0]) {
      currentAvatarPath = await uploadSingle(byId("avatarFile"));
      byId("avatarPath").textContent = currentAvatarPath;
      byId("avatarFile").value = "";
    }

    const payload = {
      hero: {
        name: byId("heroName").value.trim(),
        title: byId("heroTitle").value.trim(),
        subtitle: byId("heroSubtitle").value.trim(),
        avatar: currentAvatarPath || state.hero?.avatar || ""
      },
      about: {
        heading: byId("aboutHeading").value.trim(),
        text: byId("aboutText").value.trim()
      },
      services: byId("servicesText")
        .value
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      contacts: {
        telegram: byId("contactTelegram").value.trim(),
        email: byId("contactEmail").value.trim(),
        phone: byId("contactPhone").value.trim()
      },
      portfolio: state.portfolio || []
    };

    const data = await request("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    state = data.content;
    saveMsg.textContent = "Сохранено";
    setTimeout(() => {
      saveMsg.textContent = "";
    }, 1800);
  } catch (err) {
    saveMsg.textContent = err.message;
  }
});

byId("portfolioForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const autoUploaded = await uploadMultiple(byId("projectFiles"));
    const allImages = [...currentProjectImages, ...autoUploaded];

    const payload = {
      title: byId("portfolioTitle").value.trim(),
      description: byId("portfolioDesc").value.trim(),
      link: byId("portfolioLink").value.trim(),
      images: allImages
    };

    const data = await request("/api/admin/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    state.portfolio.unshift(data.item);
    renderPortfolioItems();

    byId("portfolioTitle").value = "";
    byId("portfolioDesc").value = "";
    byId("portfolioLink").value = "";
    byId("projectFiles").value = "";
    byId("projectPath").textContent = "";
    currentProjectImages = [];
    renderPendingProjectImages();
  } catch (err) {
    byId("projectPath").textContent = err.message;
  }
});

checkSession();
