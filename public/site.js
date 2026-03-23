(function initSite() {
  const defaultProjectImage = "/uploads/default-project-1.svg";
  const swipeThreshold = 48;

  const normalizeImages = (project) => {
    if (Array.isArray(project?.images) && project.images.length) {
      return project.images.filter(Boolean);
    }
    if (project?.image) {
      return [project.image];
    }
    return [defaultProjectImage];
  };

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text || "";
  };

  function createPortfolioCard(project) {
    const images = normalizeImages(project);
    let index = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDeltaX = 0;

    const article = document.createElement("article");
    article.className = "project";

    const media = document.createElement("div");
    media.className = "project__media";

    const image = document.createElement("img");
    image.src = images[index];
    image.alt = project.title || "Проект";
    media.appendChild(image);

    if (images.length > 1) {
      const swipeHint = document.createElement("div");
      swipeHint.className = "project__swipe-hint";
      swipeHint.textContent = "Свайпайте фото";

      const controls = document.createElement("div");
      controls.className = "project__controls";

      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.setAttribute("aria-label", "Предыдущее фото");
      prevBtn.textContent = "<";

      const counter = document.createElement("span");
      counter.textContent = `${index + 1}/${images.length}`;

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.setAttribute("aria-label", "Следующее фото");
      nextBtn.textContent = ">";

      const dots = document.createElement("div");
      dots.className = "project__dots";

      const renderDots = () => {
        dots.innerHTML = "";
        images.forEach((_, dotIndex) => {
          const dot = document.createElement("button");
          dot.type = "button";
          dot.className = "project__dot";
          if (dotIndex === index) dot.classList.add("is-active");
          dot.setAttribute("aria-label", `Перейти к фото ${dotIndex + 1}`);
          dot.addEventListener("click", () => updateSlide(dotIndex - index));
          dots.appendChild(dot);
        });
      };

      const updateSlide = (delta, swipeDirection = 1) => {
        if (!delta) return;
        index = (index + delta + images.length) % images.length;

        image.classList.remove("is-swipe-left", "is-swipe-right");
        void image.offsetWidth;
        image.classList.add(swipeDirection > 0 ? "is-swipe-left" : "is-swipe-right");

        image.src = images[index];
        counter.textContent = `${index + 1}/${images.length}`;
        renderDots();
      };

      prevBtn.addEventListener("click", () => updateSlide(-1, -1));
      nextBtn.addEventListener("click", () => updateSlide(1, 1));

      media.addEventListener(
        "touchstart",
        (event) => {
          if (event.touches.length !== 1) return;
          touchStartX = event.touches[0].clientX;
          touchStartY = event.touches[0].clientY;
          touchDeltaX = 0;
          image.style.transform = "translateX(0)";
        },
        { passive: true }
      );

      media.addEventListener(
        "touchmove",
        (event) => {
          if (!touchStartX || event.touches.length !== 1) return;

          const moveX = event.touches[0].clientX;
          const moveY = event.touches[0].clientY;
          touchDeltaX = moveX - touchStartX;
          const deltaY = moveY - touchStartY;

          if (Math.abs(touchDeltaX) > Math.abs(deltaY)) {
            event.preventDefault();
            const limited = Math.max(-36, Math.min(36, touchDeltaX * 0.22));
            image.style.transform = `translateX(${limited}px)`;
          }
        },
        { passive: false }
      );

      media.addEventListener("touchend", () => {
        if (!touchStartX) return;
        image.style.transform = "";

        if (Math.abs(touchDeltaX) > swipeThreshold) {
          if (touchDeltaX < 0) updateSlide(1, 1);
          if (touchDeltaX > 0) updateSlide(-1, -1);
        }

        touchStartX = 0;
        touchStartY = 0;
        touchDeltaX = 0;
      });

      controls.appendChild(prevBtn);
      controls.appendChild(counter);
      controls.appendChild(nextBtn);

      media.appendChild(swipeHint);
      media.appendChild(dots);
      media.appendChild(controls);
      renderDots();
    }

    const body = document.createElement("div");
    body.className = "project__body";

    const title = document.createElement("h4");
    title.textContent = project.title || "Проект";

    const desc = document.createElement("p");
    desc.textContent = project.description || "";

    body.appendChild(title);
    body.appendChild(desc);

    if (project.link) {
      const link = document.createElement("a");
      link.href = project.link;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Открыть проект";
      body.appendChild(link);
    }

    article.appendChild(media);
    article.appendChild(body);

    return article;
  }

  fetch("/api/content")
    .then((r) => r.json())
    .then((state) => {
      setText("heroName", state.hero?.name);
      setText("heroTitle", state.hero?.title);
      setText("heroSubtitle", state.hero?.subtitle);
      setText("aboutHeading", state.about?.heading);
      setText("aboutText", state.about?.text);

      const avatar = document.getElementById("heroAvatar");
      avatar.src = state.hero?.avatar || "/uploads/default-avatar.svg";

      const servicesList = document.getElementById("servicesList");
      servicesList.innerHTML = "";
      (state.services || []).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        servicesList.appendChild(li);
      });

      const grid = document.getElementById("portfolioGrid");
      grid.innerHTML = "";
      (state.portfolio || []).forEach((project) => {
        grid.appendChild(createPortfolioCard(project));
      });

      const tgRaw = state.contacts?.telegram || "";
      const tg = tgRaw.replace(/^@/, "");
      const tgUrl = tg ? `https://t.me/${tg}` : "#";

      const tgLink = document.getElementById("contactTelegram");
      tgLink.textContent = `Telegram: ${tgRaw || "не указан"}`;
      tgLink.href = tgUrl;

      const heroTelegramBtn = document.getElementById("heroTelegramBtn");
      if (heroTelegramBtn) {
        heroTelegramBtn.href = tgUrl;
      }

      const email = document.getElementById("contactEmail");
      email.textContent = `Email: ${state.contacts?.email || "не указан"}`;
      email.href = state.contacts?.email ? `mailto:${state.contacts.email}` : "#";

      const phone = document.getElementById("contactPhone");
      phone.textContent = `Телефон: ${state.contacts?.phone || "не указан"}`;
      phone.href = state.contacts?.phone ? `tel:${state.contacts.phone}` : "#";
    });
})();


