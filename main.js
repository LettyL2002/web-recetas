// src/main.js
import { createClient } from "@supabase/supabase-js";
import "./style.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;
let allRecipes = [];


function wrapWordsIn(selector = ".talkable") {
  const nodes = document.querySelectorAll(selector);
  nodes.forEach((node) => {
    if (!node) return;
    // Evitar procesar dos veces
    if (node.dataset.vwWrapped === "true") return;
    node.dataset.vwWrapped = "true";

    // Recorre nodos de texto dentro del elemento (no altera elementos ya etiquetados)
    const walker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    const textNodes = [];
    while (walker.nextNode()) {
      // Ignorar nodos que están dentro de vw-word (para prevenir doble wrapping)
      if (
        walker.currentNode.parentNode &&
        walker.currentNode.parentNode.classList &&
        walker.currentNode.parentNode.classList.contains("vw-word")
      ) {
        continue;
      }
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach((tn) => {
      const text = tn.nodeValue;
      if (!text || !text.trim()) return;
      const fragment = document.createDocumentFragment();
      // Separa manteniendo los espacios
      const parts = text.split(/(\s+)/);
      parts.forEach((part) => {
        if (part.trim() === "") {
          fragment.appendChild(document.createTextNode(part));
        } else {
          const sp = document.createElement("span");
          sp.className = "vw-word";
          sp.setAttribute("tabindex", "-1"); // no recibe tab por defecto (ajusta si quieres foco)
          sp.textContent = part;
          fragment.appendChild(sp);
        }
      });
      tn.parentNode.replaceChild(fragment, tn);
    });
  });
}

/**
 * initWordVoice(options)
 * Inicializa la escucha de hover/focus sobre .vw-word y usa SpeechSynthesis
 * para leer la palabra. Devuelve métodos enable/disable.
 */
function initWordVoice(options = {}) {
  const lang = options.lang || "es-ES";
  /* -------------------------------------------------------------
   NUEVO: Lectura por voz para botones, inputs, labels y enlaces
   ------------------------------------------------------------- */
  if ("speechSynthesis" in window) {
    const speakElementText = (text) => {
      if (!text) return;
      const msg = new SpeechSynthesisUtterance(text);
      msg.lang = "es-ES";
      msg.rate = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(msg);
    };

    // Elementos interactivos que queremos que se lean
    const selectors = "button, input, textarea, label, a";

    // Al pasar el mouse
    document.addEventListener("mouseover", (ev) => {
      const el = ev.target.closest(selectors);
      if (el) {
        let texto = "";

        // Preferir el texto visible
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          const label = document.querySelector(`label[for='${el.id}']`);
          texto = label ? label.textContent.trim() : el.placeholder || "";
        } else {
          texto = el.textContent.trim() || el.getAttribute("aria-label") || "";
        }

        if (texto) speakElementText(texto);
      }
    });

    // Al recibir foco (navegación con TAB o clic)
    document.addEventListener("focusin", (ev) => {
      const el = ev.target.closest(selectors);
      if (el) {
        let texto = "";

        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          const label = document.querySelector(`label[for='${el.id}']`);
          texto = label ? label.textContent.trim() : el.placeholder || "";
        } else {
          texto = el.textContent.trim() || el.getAttribute("aria-label") || "";
        }

        if (texto) speakElementText(texto);
      }
    });
  }

  let enabled = true;

  if (!("speechSynthesis" in window)) {
    console.warn("SpeechSynthesis API no soportada en este navegador.");
    return {
      enable: () => {},
      disable: () => {},
    };
  }

  let speakCancelTimeout = null;
  function speak(t) {
    if (!enabled) return;
    if (!t) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = lang;

    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;

    window.speechSynthesis.speak(u);

    if (speakCancelTimeout) clearTimeout(speakCancelTimeout);
    speakCancelTimeout = setTimeout(
      () => window.speechSynthesis.cancel(),
      5000
    );
  }

  document.addEventListener("mouseover", (ev) => {
    const w = ev.target.closest && ev.target.closest(".vw-word");
    if (w) {
      const txt = w.textContent.trim();
      if (txt) speak(txt);
    }
  });

  document.addEventListener("focusin", (ev) => {
    const w = ev.target.closest && ev.target.closest(".vw-word");
    if (w) {
      const txt = w.textContent.trim();
      if (txt) speak(txt);
    }
  });

  return {
    enable: () => (enabled = true),
    disable: () => {
      enabled = false;
      window.speechSynthesis.cancel();
    },
  };
}


async function init() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    currentUser = session.user;
    showMainApp();
    loadRecipes();
  } else {
    showAuthPage();
  }

  supabase.auth.onAuthStateChange((event, session) => {
    (() => {
      if (session) {
        currentUser = session.user;
        showMainApp();
        loadRecipes();
      } else {
        currentUser = null;
        showAuthPage();
      }
    })();
  });
}

function showAuthPage() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <img src="/src/public/LOGO.png" alt="Logo de BakeLovers" width=150" height="150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a10 10 0 0 1 7.38 16.75"></path>
            <path d="M12 12v10"></path>
            <path d="M12 2C9.5 2 7 3 7 6"></path>
            <path d="M12 2c2.5 0 5 1 5 4"></path>
            <circle cx="12" cy="18" r="4"></circle>
          </svg>
          <h1 class="talkable">BakeLovers</h1>
          <p class="talkable">Descubre el arte de hornear felicidad</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Iniciar Sesión</button>
          <button class="auth-tab" data-tab="register">Registrarse</button>
        </div>

        <form id="auth-form" class="auth-form">
          <div class="form-group">
            <label for="email">Correo Electrónico</label>
            <input type="email" id="email" required placeholder="tu@email.com">
          </div>
          <div class="form-group">
            <label for="password">Contraseña</label>
            <input type="password" id="password" required placeholder="••••••••">
          </div>
          <div id="auth-error" class="error-message"></div>
          <button type="submit" class="btn-primary" id="auth-submit">Iniciar Sesión</button>
        </form>
      </div>
    </div>
  `;

  const tabs = document.querySelectorAll(".auth-tab");
  const form = document.getElementById("auth-form");
  const submitBtn = document.getElementById("auth-submit");
  let currentTab = "login";

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      submitBtn.textContent =
        currentTab === "login" ? "Iniciar Sesión" : "Registrarse";
      document.getElementById("auth-error").textContent = "";
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorDiv = document.getElementById("auth-error");

    submitBtn.disabled = true;
    submitBtn.textContent = "Cargando...";

    try {
      if (currentTab === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        errorDiv.style.color = "#ec4899";
        errorDiv.textContent =
          "Cuenta creada exitosamente. Iniciando sesión...";
      }
    } catch (error) {
      errorDiv.style.color = "#ef4444";
      errorDiv.textContent = error.message;
      submitBtn.disabled = false;
      submitBtn.textContent =
        currentTab === "login" ? "Iniciar Sesión" : "Registrarse";
    }
  });

  requestAnimationFrame(() => {
    wrapWordsIn(".auth-card .talkable"); 
  });
}

function showMainApp() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="app-container">
      <header class="app-header">
        <div class="header-content">
          <div class="header-left">
            <img src="/src/public/LOGO.png"  width="150" height="150" alt="Logo de BakeLovers" />
            <h1 class="talkable">BakeLovers</h1> 
          </div>
          <div class="header-right">
            <button id="add-recipe-btn" class="btn-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nueva Receta
            </button>
            <div class="user-menu">
              <button id="user-menu-btn" class="user-menu-btn" aria-haspopup="true" aria-expanded="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </button>
              <div id="user-dropdown" class="user-dropdown" role="menu">
                <div class="user-email">${currentUser?.email || ""}</div>
                <button id="logout-btn" class="dropdown-item">Cerrar Sesión</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="main-content">
        <div class="search-section">
          <div class="search-box">
            <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input type="text" id="search-input" placeholder="Buscar receta" aria-label="Buscar receta">
          </div>
        </div>

        <div id="recipes-grid" class="recipes-grid">
          <div class="loading">Cargando recetas...</div>
        </div>
      </main>
    </div>

    <div id="recipe-modal" class="modal" aria-hidden="true" role="dialog">
      <div class="modal-content">
        <button class="modal-close" id="close-modal" aria-label="Cerrar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div id="modal-body"></div>
      </div>
    </div>

    <div id="add-modal" class="modal" aria-hidden="true">
      <div class="modal-content">
        <button class="modal-close" id="close-add-modal" aria-label="Cerrar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="modal-header">
          <h2 class="talkable">Nueva Receta de Cupcake</h2>
        </div>
        <form id="add-recipe-form" class="recipe-form">
          <div class="form-group">
            <label for="recipe-name">Nombre</label>
            <input type="text" id="recipe-name" required placeholder="Ej: Vanilla Dream">
          </div>
          <div class="form-group">
            <label for="recipe-description">Descripción</label>
            <input type="text" id="recipe-description" required placeholder="Breve descripción del cupcake">
          </div>
          <div class="form-group">
            <label for="recipe-image">URL de la Imagen</label>
            <input type="url" id="recipe-image" required placeholder="https://...">
          </div>
          <div class="form-group">
            <label for="recipe-ingredients">Ingredientes (uno por línea)</label>
            <textarea id="recipe-ingredients" rows="6" required placeholder="2 tazas de harina&#10;1 taza de azúcar&#10;..."></textarea>
          </div>
          <div class="form-group">
            <label for="recipe-instructions">Instrucciones (uno por línea)</label>
            <textarea id="recipe-instructions" rows="8" required placeholder="Precalentar el horno a 180°C&#10;Mezclar ingredientes secos&#10;..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="cancel-add">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar Receta</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const userMenuBtn = document.getElementById("user-menu-btn");
  const userDropdown = document.getElementById("user-dropdown");
  const logoutBtn = document.getElementById("logout-btn");
  const searchInput = document.getElementById("search-input");
  const addRecipeBtn = document.getElementById("add-recipe-btn");
  const addModal = document.getElementById("add-modal");
  const closeAddModal = document.getElementById("close-add-modal");
  const cancelAdd = document.getElementById("cancel-add");
  const addRecipeForm = document.getElementById("add-recipe-form");

  userMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const expanded = userMenuBtn.getAttribute("aria-expanded") === "true";
    userMenuBtn.setAttribute("aria-expanded", (!expanded).toString());
    userDropdown.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    userDropdown.classList.remove("show");
    userMenuBtn.setAttribute("aria-expanded", "false");
  });

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    filterRecipes(query);
  });

  addRecipeBtn.addEventListener("click", () => {
    addModal.classList.add("show");

    requestAnimationFrame(() => wrapWordsIn("#add-modal .talkable"));
  });

  closeAddModal.addEventListener("click", () => {
    addModal.classList.remove("show");
    addRecipeForm.reset();
  });

  cancelAdd.addEventListener("click", () => {
    addModal.classList.remove("show");
    addRecipeForm.reset();
  });

  addRecipeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("recipe-name").value;
    const description = document.getElementById("recipe-description").value;
    const imageUrl = document.getElementById("recipe-image").value;
    const ingredients = document.getElementById("recipe-ingredients").value;
    const instructions = document.getElementById("recipe-instructions").value;

    const { error } = await supabase.from("recipes").insert({
      user_id: currentUser.id,
      name,
      description,
      image_url: imageUrl,
      ingredients,
      instructions,
    });

    if (error) {
      alert("Error al guardar la receta: " + error.message);
    } else {
      addModal.classList.remove("show");
      addRecipeForm.reset();
      loadRecipes();
    }
  });

  // Después de renderizar la interfaz principal, envolver textos comunes
  requestAnimationFrame(() => {
    // envolver header y botones
    wrapWordsIn(".app-container .talkable");
  });
}

async function loadRecipes() {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading recipes:", error);
    return;
  }

  allRecipes = data || [];
  displayRecipes(allRecipes);
}

function displayRecipes(recipes) {
  const grid = document.getElementById("recipes-grid");

  if (recipes.length === 0) {
    grid.innerHTML =
      '<div class="no-recipes talkable">No hay recetas disponibles. ¡Crea la primera!</div>';

    requestAnimationFrame(() => wrapWordsIn("#recipes-grid .talkable"));
    return;
  }

  grid.innerHTML = recipes
    .map(
      (recipe) => `
    <div class="recipe-card" data-id="${recipe.id}">
      <div class="recipe-image" style="background-image: url('${
        recipe.image_url
      }')"></div>
      <div class="recipe-content talkable">
        <h3 class="recipe-title">${recipe.name}</h3>
        <p class="recipe-description">${recipe.description}</p>
        <div class="recipe-actions">
          <button class="btn-view" data-id="${recipe.id}">Ver Receta</button>
          ${
            recipe.user_id === currentUser?.id
              ? `<button class="btn-delete" data-id="${recipe.id}">Eliminar</button>`
              : ""
          }
        </div>
      </div>
    </div>
  `
    )
    .join("");

  document.querySelectorAll(".btn-view").forEach((btn) => {
    btn.addEventListener("click", () => showRecipeDetail(btn.dataset.id));
  });

  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteRecipe(btn.dataset.id);
    });
  });

  requestAnimationFrame(() => {
    wrapWordsIn("#recipes-grid .talkable");
  });
}

function filterRecipes(query) {
  if (!query) {
    displayRecipes(allRecipes);
    return;
  }

  const filtered = allRecipes.filter((recipe) => {
    return (
      recipe.name.toLowerCase().includes(query) ||
      recipe.description.toLowerCase().includes(query) ||
      recipe.ingredients.toLowerCase().includes(query)
    );
  });

  displayRecipes(filtered);
}

function showRecipeDetail(recipeId) {
  const recipe = allRecipes.find((r) => r.id === recipeId);
  if (!recipe) return;

  const modal = document.getElementById("recipe-modal");
  const modalBody = document.getElementById("modal-body");

  const ingredients = recipe.ingredients.split("\n").filter((i) => i.trim());
  const instructions = recipe.instructions.split("\n").filter((i) => i.trim());

  modalBody.innerHTML = `
    <div class="recipe-detail">
      <div class="recipe-detail-image" style="background-image: url('${
        recipe.image_url
      }')"></div>
      <div class="recipe-detail-content talkable">
        <h2 class="talkable">${recipe.name}</h2>
        <p class="recipe-detail-description talkable">${recipe.description}</p>

        <div class="recipe-section">
          <h3 class="talkable">Ingredientes</h3>
          <ul class="ingredients-list">
            ${ingredients.map((i) => `<li class="talkable">${i}</li>`).join("")}
          </ul>
        </div>

        <div class="recipe-section">
          <h3 class="talkable">Instrucciones</h3>
          <ol class="instructions-list">
            ${instructions
              .map((i) => `<li class="talkable">${i}</li>`)
              .join("")}
          </ol>
        </div>
      </div>
    </div>
  `;

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    wrapWordsIn("#modal-body .talkable");
  });

  document.getElementById("close-modal").onclick = () => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    }
  };
}

async function deleteRecipe(recipeId) {
  if (!confirm("¿Estás seguro de que quieres eliminar esta receta?")) {
    return;
  }

  const { error } = await supabase.from("recipes").delete().eq("id", recipeId);

  if (error) {
    alert("Error al eliminar la receta: " + error.message);
  } else {
    loadRecipes();
  }
}

const wordVoice = initWordVoice({ lang: "es-ES" });


(function createVoiceToggleButton() {
  const btn = document.createElement("button");
  btn.id = "voice-toggle-button";
  btn.setAttribute("aria-pressed", "true");
  btn.title = "Activar / Desactivar lectura por palabra";
  btn.innerText = "Voz: ON";
  Object.assign(btn.style, {
    position: "fixed",
    right: "12px",
    bottom: "12px",
    zIndex: 9999,
    padding: "8px 12px",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    background: "#fff",
    cursor: "pointer",
  });
  btn.addEventListener("click", () => {
    const pressed = btn.getAttribute("aria-pressed") === "true";
    if (pressed) {
      wordVoice.disable();
      btn.innerText = "Voz: OFF";
      btn.setAttribute("aria-pressed", "false");
    } else {
      wordVoice.enable();
      btn.innerText = "Voz: ON";
      btn.setAttribute("aria-pressed", "true");
    }
  });

  document.addEventListener("DOMContentLoaded", () =>
    document.body.appendChild(btn)
  );
})();



init();
