/* ============================================
   CP09 SQUADRA — APP.JS v2.0
   ============================================ */

// ==========================================
// HEADER SCROLL
// ==========================================
const header = document.getElementById("header");
if (header) {
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 20);
  });
}

// ==========================================
// BURGER MENU
// ==========================================
const burgerBtn = document.getElementById("burgerBtn");
const mobileNav = document.getElementById("mobileNav");

if (burgerBtn && mobileNav) {
  burgerBtn.addEventListener("click", () => {
    burgerBtn.classList.toggle("open");
    mobileNav.classList.toggle("open");
  });
  mobileNav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      burgerBtn.classList.remove("open");
      mobileNav.classList.remove("open");
    });
  });
}

// ==========================================
// SCROLL ANIMATIONS (IntersectionObserver)
// ==========================================
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible", "is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll("[data-animate], .fade-in, .card").forEach(el => {
    observer.observe(el);
  });
} else {
  document.querySelectorAll("[data-animate], .fade-in, .card").forEach(el => {
    el.classList.add("visible", "is-visible");
  });
}

// ==========================================
// PARALLAX IMAGES
// ==========================================
function handleParallax() {
  const winH = window.innerHeight;
  document.querySelectorAll(".parallax-img, .full-parallax").forEach(wrapper => {
    const img = wrapper.querySelector("img");
    if (!img) return;
    const rect = wrapper.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < winH) {
      const ratio = rect.top / winH;
      const move = (ratio - 0.5) * 60;
      img.style.transform = `translate(-50%, calc(-50% + ${move}px))`;
    }
  });
}
window.addEventListener("scroll", handleParallax, { passive: true });
window.addEventListener("load", handleParallax);

// ==========================================
// TILT CARDS
// ==========================================
document.querySelectorAll(".tilt-card").forEach(card => {
  card.addEventListener("mousemove", e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotX = ((y - rect.height / 2) / rect.height) * -6;
    const rotY = ((x - rect.width / 2) / rect.width) * 6;
    card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
  });
  card.addEventListener("mouseleave", () => {
    card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)";
  });
});

// ==========================================
// COUNTER ANIMATION (stats)
// ==========================================
function animateCounter(el, target, duration = 1500) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) { start = target; clearInterval(timer); }
    el.textContent = Math.floor(start);
  }, 16);
}

const statsObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.getAttribute("data-count"), 10);
      if (!isNaN(target)) animateCounter(el, target);
      statsObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll(".stat-value[data-count]").forEach(el => {
  el.textContent = "0";
  statsObserver.observe(el);
});

// ==========================================
// PANIER — CART
// ==========================================
let cart = [];

function renderCart() {
  const cartEmpty   = document.getElementById("cart-empty");
  const cartContent = document.getElementById("cart-content");
  const cartItems   = document.getElementById("cart-items");
  const cartTotal   = document.getElementById("cart-total");
  if (!cartEmpty || !cartContent || !cartItems || !cartTotal) return;

  if (cart.length === 0) {
    cartEmpty.style.display = "block";
    cartContent.style.display = "none";
    cartItems.innerHTML = "";
    cartTotal.textContent = "";
    return;
  }

  cartEmpty.style.display = "none";
  cartContent.style.display = "block";
  cartItems.innerHTML = "";
  let total = 0;

  cart.forEach(item => {
    const lineTotal = item.price * item.qty;
    total += lineTotal;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${item.title}</strong></td>
      <td>${item.size || "—"}</td>
      <td style="white-space:nowrap;">
        <button class="cart-minus" data-id="${item.id}">−</button>
        <span style="margin:0 10px;">${item.qty}</span>
        <button class="cart-plus" data-id="${item.id}">+</button>
      </td>
      <td>${item.price.toFixed(2)} €</td>
      <td><strong>${lineTotal.toFixed(2)} €</strong></td>
      <td><button class="cart-remove" data-id="${item.id}">✕</button></td>
    `;
    cartItems.appendChild(tr);
  });

  cartTotal.textContent = "Total : " + total.toFixed(2) + " €";

  document.querySelectorAll(".cart-minus").forEach(btn => {
    btn.addEventListener("click", () => updateQty(btn.dataset.id, -1));
  });
  document.querySelectorAll(".cart-plus").forEach(btn => {
    btn.addEventListener("click", () => updateQty(btn.dataset.id, 1));
  });
  document.querySelectorAll(".cart-remove").forEach(btn => {
    btn.addEventListener("click", () => removeFromCart(btn.dataset.id));
  });
}

function addToCart(id, title, price, size) {
  const key = `${id}-${size}`;
  const existing = cart.find(item => item.id === key);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: key, originalId: id, title, price, qty: 1, size });
  }
  renderCart();
  // Scroll vers le panier
  const cartSection = document.getElementById("cart-section");
  if (cartSection) cartSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  renderCart();
}

// ==========================================
// DOM READY
// ==========================================
document.addEventListener("DOMContentLoaded", () => {

  // Boutons "Ajouter au panier"
  document.querySelectorAll(".add-to-cart").forEach(btn => {
    btn.addEventListener("click", () => {
      const id    = btn.dataset.id;
      const title = btn.dataset.title;
      const price = parseFloat(btn.dataset.price);
      const card  = btn.closest(".product-card");
      const select = card ? card.querySelector(".product-size-select") : null;

      if (!select) { alert("Erreur : sélecteur de taille introuvable."); return; }
      const size = select.value;
      if (!size) { alert("Choisis une taille avant d'ajouter au panier."); return; }

      addToCart(id, title, price, size);

      // Feedback visuel
      const original = btn.textContent;
      btn.textContent = "✓ Ajouté !";
      btn.style.background = "#00d46a";
      setTimeout(() => {
        btn.textContent = original;
        btn.style.background = "";
      }, 1500);
    });
  });

  // Checkout Stripe
  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", async () => {
      if (cart.length === 0) { alert("Ton panier est vide."); return; }
      if (!window.STRIPE_PUBLIC_KEY || !window.Stripe) { alert("Stripe non initialisé."); return; }

      let stripe;
      try { stripe = Stripe(window.STRIPE_PUBLIC_KEY); } catch(e) { alert("Erreur Stripe."); return; }

      checkoutBtn.textContent = "Chargement...";
      checkoutBtn.disabled = true;

      const items = cart.map(item => ({
        id: item.originalId,
        title: item.title,
        price: item.price,
        qty: item.qty,
        size: item.size
      }));

      try {
        const res = await fetch("/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items })
        });
        const data = await res.json();
        if (!data.id) { alert("Erreur serveur : " + (data.error || "Session introuvable.")); return; }
        const result = await stripe.redirectToCheckout({ sessionId: data.id });
        if (result.error) alert(result.error.message);
      } catch (err) {
        alert("Erreur de connexion au serveur.");
      } finally {
        checkoutBtn.textContent = "Payer maintenant →";
        checkoutBtn.disabled = false;
      }
    });
  }

  // Formulaire événement
  const eventForm = document.getElementById("event-form");
  const eventStatus = document.getElementById("event-form-status");
  if (eventForm) {
    eventForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (eventStatus) eventStatus.textContent = "Envoi en cours...";
      const btn = eventForm.querySelector("[type=submit]");
      if (btn) { btn.disabled = true; btn.textContent = "Envoi..."; }

      const formData = {
        name:      eventForm.name.value,
        email:     eventForm.email.value,
        phone:     eventForm.phone.value,
        city:      eventForm.city.value,
        date:      eventForm.date.value,
        eventType: eventForm.eventType.value,
        budget:    eventForm.budget.value,
        message:   eventForm.message.value
      };

      try {
        const res  = await fetch("/event-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur serveur");
        if (eventStatus) {
          eventStatus.textContent = "✅ Demande envoyée — on te répond sous 48h !";
          eventStatus.style.color = "#00d46a";
        }
        eventForm.reset();
      } catch (err) {
        if (eventStatus) {
          eventStatus.textContent = "❌ Impossible d'envoyer. Réessaie ou contacte-nous sur Instagram.";
          eventStatus.style.color = "#ff2d2d";
        }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Envoyer la demande →"; }
      }
    });
  }

  // Rendu initial du panier
  renderCart();
});
