document.addEventListener('DOMContentLoaded', function () {
  const chapterLinks = document.querySelectorAll('.toc-link');
  const articleLinks = document.querySelectorAll('.toc-sublink');
  const sections = document.querySelectorAll('.terms-chapter, .terms-article');

  // 1. Chapter click: Toggle accordion, do NOT scroll
  chapterLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      // Find the sibling .toc-sublist
      const parentLi = this.parentElement;
      const sublist = parentLi.querySelector('.toc-sublist');

      if (sublist) {
        // Toggle the 'open' class
        sublist.classList.toggle('open');
      } else {
        // No sublist (e.g. privacy policy), scroll to area
        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          window.scrollTo({
            top: targetElement.offsetTop - 100,
            behavior: 'smooth'
          });
        }
      }
    });
  });

  // 2. Article click: Scroll to area
  articleLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 100,
          behavior: 'smooth'
        });
      }
    });
  });

  // 3. Scroll spy
  window.addEventListener('scroll', function () {
    let current = '';
    const scrollPosition = window.scrollY + 120;

    sections.forEach(section => {
      if (section.offsetTop <= scrollPosition) {
        current = section.getAttribute('id');
      }
    });

    articleLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href').substring(1) === current) {
        link.classList.add('active');
        // Auto-open logic removed as per user request
      }
    });

    chapterLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href').substring(1) === current) {
        link.classList.add('active');
      } else {
        const parentLi = link.parentElement;
        const sublist = parentLi.querySelector('.toc-sublist');
        if (sublist && sublist.querySelector('.toc-sublink.active')) {
          link.classList.add('active');
        }
      }
    });
  });

  // 4. Scroll Buttons
  const scrollBtns = document.querySelector('.scroll-buttons');
  const btnTop = document.querySelector('.scroll-top');
  const btnBottom = document.querySelector('.scroll-bottom');

  if (scrollBtns) {
    window.addEventListener('scroll', function () {
      // Show/hide logic
      if (window.scrollY > 300) {
        scrollBtns.classList.add('visible');
      } else {
        scrollBtns.classList.remove('visible');
      }

      // Prevent overlapping with footer
      const footer = document.querySelector('footer');
      if (footer) {
        const footerRect = footer.getBoundingClientRect();
        if (footerRect.top < window.innerHeight) {
          scrollBtns.style.bottom = (window.innerHeight - footerRect.top + 40) + 'px';
        } else {
          scrollBtns.style.bottom = '40px';
        }
      }
    });

    if (btnTop) {
      btnTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    if (btnBottom) {
      btnBottom.addEventListener('click', function () {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });
    }
  }
});
