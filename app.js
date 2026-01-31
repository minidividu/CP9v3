// ==========================
// CONFIGURATION & ETAT
// ==========================
// On garde la structure pour le futur, mais on désactive Stripe pour la V2 sans paiement
let stripe = null; 
let cart = JSON.parse(localStorage.getItem("cp09_cart")) || [];

// ==========================
// FONCTIONS DU PANIER (OPTIMISÉES)
// ==========================
function saveCart() {
    localStorage.setItem("cp09_cart", JSON.stringify(cart));
}

function renderCart() {
    const cartEmpty = document.getElementById("cart-empty");
    const cartContent = document.getElementById("cart-content");
    const cartItemsContainer = document.getElementById("cart-items");
    const cartTotal = document.getElementById("cart-total");

    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        if (cartEmpty) cartEmpty.style.display = "block";
        if (cartContent) cartContent.style.display = "none";
        return;
    }

    if (cartEmpty) cartEmpty.style.display = "none";
    if (cartContent) cartContent.style.display = "block";
    cartItemsContainer.innerHTML = "";

    let total = 0;
    cart.forEach((item) => {
        const lineTotal = item.price * item.qty;
        total += lineTotal;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${item.title}</strong><br><small>Taille : ${item.size}</small></td>
            <td>
                <button class="btn-qty" onclick="updateQty('${item.id}', '${item.size}', -1)">-</button>
                <span style="margin:0 10px;">${item.qty}</span>
                <button class="btn-qty" onclick="updateQty('${item.id}', '${item.size}', 1)">+</button>
            </td>
            <td>${item.price.toFixed(2)} €</td>
            <td><button class="btn-remove" onclick="removeFromCart('${item.id}', '${item.size}')">✕</button></td>
        `;
        cartItemsContainer.appendChild(tr);
    });

    if (cartTotal) cartTotal.textContent = `Total Estimé : ${total.toFixed(2)} €`;
    saveCart();
}

// ... (Garder addToCart, updateQty, removeFromCart identiques à ton code)

// ==========================
// INITIALISATION AU CHARGEMENT
// ==========================
document.addEventListener("DOMContentLoaded", () => {
    renderCart();

    // --- 1. Animation des Stats (AJOUTÉ POUR L'IMPACT) ---
    const statsValues = document.querySelectorAll('.stat-value');
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const countTo = parseInt(target.getAttribute('data-count'));
                let count = 0;
                const speed = 2000 / countTo;
                const updateCount = () => {
                    if (count < countTo) {
                        count++;
                        target.innerText = count;
                        setTimeout(updateCount, speed);
                    }
                };
                updateCount();
                statsObserver.unobserve(target);
            }
        });
    }, { threshold: 0.5 });
    statsValues.forEach(v => statsObserver.observe(v));

    // --- 2. Menu Burger (Optimisé) ---
    const burgerBtn = document.getElementById("burgerBtn");
    const mobileNav = document.getElementById("mobileNav");
    if (burgerBtn && mobileNav) {
        burgerBtn.onclick = () => {
            mobileNav.classList.toggle("open");
            burgerBtn.textContent = mobileNav.classList.contains("open") ? "✕" : "☰";
        };
    }

    // --- 3. Reveal Observer (SEO & UX) ---
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll("[data-animate], .card").forEach(el => revealObserver.observe(el));

    // --- 4. Bouton Checkout : Capture de Lead (MODIFIÉ) ---
    const checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            if (cart.length === 0) return alert("Le panier est vide.");
            
            // Au lieu de Stripe, on redirige vers l'inscription ou on affiche un message
            checkoutBtn.innerHTML = "Réservé ! Redirection...";
            setTimeout(() => {
                alert("Le shop est en maintenance pour le prochain drop. Ton panier a été enregistré, tu recevras un mail dès l'ouverture !");
                // Optionnel : scroller vers la newsletter
                document.getElementById('newsletterForm').scrollIntoView({behavior: 'smooth'});
            }, 1000);
        });
    }

    // --- 5. Effet Tilt (Maintenu car très impactant visuellement) ---
    document.querySelectorAll(".tilt-card").forEach((card) => {
        card.addEventListener("mousemove", (e) => {
            const rect = card.getBoundingClientRect();
            const rotateX = ((e.clientY - rect.top - rect.height / 2) / rect.height) * -10;
            const rotateY = ((e.clientX - rect.left - rect.width / 2) / rect.width) * 10;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        });
        card.addEventListener("mouseleave", () => {
            card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)";
        });
    });

    // --- 6. Newsletter (Optimisée pour la réponse) ---
    const newsletterForm = document.getElementById("newsletterForm");
    if (newsletterForm) {
        newsletterForm.onsubmit = (e) => {
            e.preventDefault();
            const btn = newsletterForm.querySelector('button');
            const status = document.getElementById("newsletterMsg");
            btn.innerText = "Validation...";
            
            setTimeout(() => {
                status.innerText = "T'es dans la Squadra. Surveille tes mails.";
                status.style.color = "#fff";
                btn.innerText = "C'est carré";
                newsletterForm.reset();
            }, 1500);
        };
    }
});
