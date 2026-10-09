// Badi Katori - Heritage Retro-Modern Static Website Main Controller

// Global constants & variables
let currentScrollPercent = 0;
let statsAnimated = false;

// Custom Cursor coordinates
const cursor = { x: 0, y: 0, targetX: 0, targetY: 0 };
const follower = { x: 0, y: 0, targetX: 0, targetY: 0 };

// Dish Data for specialties details and image updates
const dishData = [
  {
    pairing: "Saffron-infused Gin & Tonic with Cardamom Bitters",
    profile: ["Creamy", "Crispy", "Royal", "Saffron Glow"],
    image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=500&auto=format&fit=crop" // Paneer dish
  },
  {
    pairing: "Single-Malt Islay Whiskey Smoked with Applewood",
    profile: ["Melt-in-mouth", "Earthy", "Pungent", "Truffle Aroma"],
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=500&auto=format&fit=crop" // Kebab/meat style
  },
  {
    pairing: "Mint-Cilantro & Tamarind Infused Sparkler (Non-Alcoholic)",
    profile: ["Tangy", "Geometric", "Cold Espuma", "Herbaceous"],
    image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=500&auto=format&fit=crop" // Spiced chaat/samosa style
  },
  {
    pairing: "Sparkling Rose Champagne or Saffron-Kesar Lassi",
    profile: ["Double-cream", "Sweet Caviar", "Floral", "Cold & Silky"],
    image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=500&auto=format&fit=crop" // Traditional dessert style
  }
];

function _initThisModule() {
  // Initialize UI Controllers
  initCursor();
  initScrollTracker();
  initIntersectionObserver();
  initDishSelector();
  initStatsCounter();
  initMagneticButtons();
  initBookingForm();
  initMobileMenu();
});

// 1. Custom Luxury Cursor
function initCursor() {
  const cursorDot = document.getElementById('custom-cursor');
  const cursorFollower = document.getElementById('custom-cursor-follower');
  
  if (!cursorDot || !cursorFollower) return;

  // Track mouse coordinates
  window.addEventListener('mousemove', (e) => {
    cursor.targetX = e.clientX;
    cursor.targetY = e.clientY;
    
    follower.targetX = e.clientX;
    follower.targetY = e.clientY;
  });

  // Smooth cursor follow loop
  const updateCursor = () => {
    // Lerp dot (very fast)
    cursor.x += (cursor.targetX - cursor.x) * 0.3;
    cursor.y += (cursor.targetY - cursor.y) * 0.3;
    cursorDot.style.left = `${cursor.x}px`;
    cursorDot.style.top = `${cursor.y}px`;

    // Lerp follower (slightly slower for trailing lag)
    follower.x += (follower.targetX - follower.x) * 0.15;
    follower.y += (follower.targetY - follower.y) * 0.15;
    cursorFollower.style.left = `${follower.x}px`;
    cursorFollower.style.top = `${follower.y}px`;

    requestAnimationFrame(updateCursor);
  };
  updateCursor();

  // Hover States Listeners
  const hoverTargets = document.querySelectorAll('a, button, .dish-item, input, select, textarea');
  hoverTargets.forEach(target => {
    target.addEventListener('mouseenter', () => {
      document.body.classList.add('cursor-hover');
    });
    target.addEventListener('mouseleave', () => {
      document.body.classList.remove('cursor-hover');
    });
  });
}

// 2. Scroll Tracker & Navigation Highlighting
function initScrollTracker() {
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    
    if (scrollHeight > 0) {
      currentScrollPercent = scrollTop / scrollHeight;
    }

    // Scroll Indicator Hide/Show
    const scrollIndicator = document.getElementById('scroll-indicator');
    if (scrollIndicator) {
      if (scrollTop > 100) {
        scrollIndicator.style.opacity = '0';
        scrollIndicator.style.pointerEvents = 'none';
      } else {
        scrollIndicator.style.opacity = '1';
        scrollIndicator.style.pointerEvents = 'auto';
      }
    }

    // Nav Bar shrink background padding
    const header = document.getElementById('main-header');
    if (header) {
      if (scrollTop > 50) {
        header.style.padding = '0.9rem 0';
      } else {
        header.style.padding = '1.8rem 0';
      }
    }

    // Active Navigation Highlight on Scroll
    let currentActiveId = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 180;
      const sectionHeight = section.clientHeight;
      if (scrollTop >= sectionTop && scrollTop < sectionTop + sectionHeight) {
        currentActiveId = section.getAttribute('id');
      }
    });

    if (currentActiveId) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentActiveId}`) {
          link.classList.add('active');
        }
      });
    }
  });
}

// 3. Scroll Reveal Animations (Intersection Observer)
function initIntersectionObserver() {
  const revealElements = document.querySelectorAll('.reveal-fade, .reveal-slide-left, .reveal-slide-right');
  
  const observerOptions = {
    threshold: 0.12,
    rootMargin: "0px 0px -50px 0px"
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach(el => observer.observe(el));
}

// 4. Dish Selector (Specialties Section)
function initDishSelector() {
  const dishItems = document.querySelectorAll('.dish-item');
  const pairingText = document.getElementById('dish-pairing-text');
  const profileTags = document.getElementById('dish-profile-tags');
  const previewImg = document.getElementById('dish-preview-image');
  const dishCard = document.querySelector('.dish-display-card');

  dishItems.forEach(item => {
    item.addEventListener('click', () => {
      // 1. Manage Active Class in DOM
      dishItems.forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      // 2. Fetch data attributes
      const index = parseInt(item.getAttribute('data-dish'));
      
      // 3. Animate right details card with smooth text change
      if (dishCard) {
        dishCard.style.opacity = '0.3';
        dishCard.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
          // Update Pairing
          if (pairingText) pairingText.textContent = dishData[index].pairing;

          // Update Image
          if (previewImg) {
            previewImg.style.backgroundImage = `url('${dishData[index].image}')`;
          }

          // Update Tags
          if (profileTags) {
            profileTags.innerHTML = '';
            dishData[index].profile.forEach(tag => {
              const span = document.createElement('span');
              span.textContent = tag;
              profileTags.appendChild(span);
            });
          }

          dishCard.style.opacity = '1';
          dishCard.style.transform = 'translateY(0)';
        }, 250);
      }
    });
  });
}

// 5. Stats Counter Animation
function initStatsCounter() {
  const statsSection = document.querySelector('.stats-counter-grid');
  if (!statsSection) return;

  const countUp = () => {
    const stats = document.querySelectorAll('.stat-number');
    stats.forEach(stat => {
      const target = parseFloat(stat.getAttribute('data-target'));
      const suffix = stat.id === 'stat-spices' ? '+' : (stat.id === 'stat-served' ? 'k' : (stat.id === 'stat-diners' ? 'k' : 'k+'));
      
      let current = 0;
      const increment = target / 50;
      const interval = setInterval(() => {
        current += increment;
        if (current >= target) {
          stat.textContent = target + suffix;
          clearInterval(interval);
        } else {
          stat.textContent = Math.floor(current) + suffix;
        }
      }, 30);
    });
  };

  // Trigger when scrolling into viewport
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !statsAnimated) {
      statsAnimated = true;
      countUp();
    }
  }, { threshold: 0.5 });

  observer.observe(statsSection);
}

// 6. Magnetic Hover Effect on Buttons
function initMagneticButtons() {
  const magneticButtons = document.querySelectorAll('.btn-magnetic');

  magneticButtons.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      // Pull button slightly towards mouse
      btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
      
      // Pull inner text/arrow slightly faster for parallax depth
      const arrow = btn.querySelector('.arrow');
      if (arrow) {
        arrow.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
      }
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0px, 0px)';
      const arrow = btn.querySelector('.arrow');
      if (arrow) {
        arrow.style.transform = 'translate(0px, 0px)';
      }
    });
  });
}

// 7. Booking Form Handler
function initBookingForm() {
  const form = document.getElementById('booking-form');
  const successMsg = document.getElementById('booking-success-msg');
  const preSelectCheckbox = document.getElementById('pre-select-tasting');
  const addTastingBtn = document.getElementById('add-to-reservation-btn');

  // Interactive connection: clicking "Add to tasting" in menu card updates form checkbox
  if (addTastingBtn && preSelectCheckbox) {
    addTastingBtn.addEventListener('click', () => {
      preSelectCheckbox.checked = true;
      // Scroll smoothly to form
      document.getElementById('reserve').scrollIntoView({ behavior: 'smooth' });
      
      // Flash the button inside form to show it changed
      preSelectCheckbox.parentElement.style.backgroundColor = 'rgba(194, 159, 104, 0.15)';
      setTimeout(() => {
        preSelectCheckbox.parentElement.style.backgroundColor = 'transparent';
      }, 1000);
    });
  }

  if (form && successMsg) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Fade out form
      form.style.opacity = '0';
      setTimeout(() => {
        form.style.display = 'none';
        
        // Show success message
        successMsg.style.display = 'flex';
      }, 300);
    });
  }
}

// 8. Mobile Menu Toggle
function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const navMenu = document.getElementById('nav-menu');

  if (menuBtn && navMenu) {
    menuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('mobile-open');
      menuBtn.classList.toggle('active');
      
      // Hamburger bars animation
      const bars = menuBtn.querySelectorAll('.bar');
      if (menuBtn.classList.contains('active')) {
        bars[0].style.transform = 'rotate(-45deg) translate(-5px, 6px)';
        bars[1].style.opacity = '0';
        bars[2].style.transform = 'rotate(45deg) translate(-5px, -6px)';
      } else {
        bars[0].style.transform = 'none';
        bars[1].style.opacity = '1';
        bars[2].style.transform = 'none';
      }
    });

    // Close menu when clicking links
    const links = navMenu.querySelectorAll('.nav-link');
    links.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('mobile-open');
        menuBtn.classList.remove('active');
        const bars = menuBtn.querySelectorAll('.bar');
        bars[0].style.transform = 'none';
        bars[1].style.opacity = '1';
        bars[2].style.transform = 'none';
      });
    }
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initThisModule);
    } else {
        _initThisModule();
    }
}
  }
}
