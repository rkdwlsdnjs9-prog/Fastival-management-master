document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const name = e.target.getAttribute('data-name');
      alert(`🛒 [${name}]이 모바일 장바구니에 정상 담겼습니다!`);
    });
  });

  document.getElementById('instantOrderBtn').addEventListener('click', function() {
    const slot = document.getElementById('timeSlot').value;
    alert(`🎉 주문이 전송되었습니다! 타임슬롯 ${slot}에 마포 닭강정/떡볶이 푸드트럭으로 방문해 주세요. 픽업 바코드가 발권되었습니다.`);
  });