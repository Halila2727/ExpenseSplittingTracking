gsap.registerPlugin(ScrollTrigger);

// Hero
gsap.from(".hero-logo", { duration: 1.2, y: -50, opacity: 0, ease: "power3.out" });
gsap.from(".hero p, .hero .btn", { duration: 1, opacity: 0, y: 20, stagger: 0.2, ease: "power2.out", delay: 0.3 });

// Features
// grab all feature cards
const cards = gsap.utils.toArray(".feature-card");

// how many cards per row (adjust if needed)
const perRow = 3; 

for (let i = 0; i < cards.length; i += perRow) {
  const row = cards.slice(i, i + perRow);

  gsap.from(row, {
    scrollTrigger: {
      trigger: row[0],       // trigger when the first card in the row enters
      start: "top 80%",
      toggleActions: "play none none none"
    },
    opacity: 0,
    y: 50,
    duration: 0.8,
    stagger: 0.3,            // animate cards left → right in the row
    ease: "power2.out"
  });
}


// Steps
gsap.from(".step", {
  scrollTrigger: { trigger: ".how-it-works", start: "top 80%" },
  opacity: 0,
  scale: 0.8,
  stagger: 0.3,
  duration: 0.8,
  ease: "back.out(1.7)"
});

// CTA
gsap.from(".cta h2, .cta p, .cta .btn", {
  scrollTrigger: { trigger: ".cta", start: "top 85%" },
  y: 40,
  opacity: 0,
  stagger: 0.2,
  duration: 1,
  ease: "power2.out"
});

// Footer
gsap.from("footer .footer-column", {
  scrollTrigger: { trigger: "footer", start: "top 90%" },
  opacity: 0,
  y: 30,
  stagger: 0.2,
  duration: 0.8,
  ease: "power2.out"
});


gsap.registerPlugin(ScrollTrigger);

const features = gsap.utils.toArray(".feature-card");

// Show first description initially
features[0].classList.add("active");

// Keep track of the active card
let currentActive = 0;

// ScrollTrigger: toggle description with a slight delay for hiding
features.forEach((card, i) => {
  ScrollTrigger.create({
    trigger: card,
    start: "top 70%",
    end: "bottom 70%",
    onEnter: () => showDescription(i),
    onEnterBack: () => showDescription(i),
  });
});

function showDescription(index) {
  // Only change if a new card becomes active
  if (index === currentActive) return;

  // Hide previous description with a small delay
  const prevCard = features[currentActive];
  if (prevCard) {
    setTimeout(() => {
      prevCard.classList.remove("active");
    }, 1000); // 1000ms delay before hiding
  }

  // Show new description immediately
  features[index].classList.add("active");
  currentActive = index;
}
