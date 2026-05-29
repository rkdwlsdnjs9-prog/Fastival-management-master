document.addEventListener('DOMContentLoaded', () => {
  const recentCarousel = document.querySelector('.recent-carousel');
  if (recentCarousel) {
    const prevBtn = recentCarousel.querySelector('.recent-prev');
    const nextBtn = recentCarousel.querySelector('.recent-next');
    const track = recentCarousel.querySelector('.recent-carousel-track');
    const items = recentCarousel.querySelectorAll('.recent-item');
    let currentIndex = 0;

    const showItem = (index) => {
      if (track) {
        track.style.transform = `translateX(-${index * 100}%)`;
      }
    };

    if (prevBtn && nextBtn && items.length > 0) {
      prevBtn.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + items.length) % items.length;
        showItem(currentIndex);
      });
      nextBtn.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % items.length;
        showItem(currentIndex);
      });
    }
  }
});
