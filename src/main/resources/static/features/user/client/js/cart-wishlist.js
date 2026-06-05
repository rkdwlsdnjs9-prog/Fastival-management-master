document.getElementById('checkoutBtn').addEventListener('click', function() {
    if(confirm("💳 총 ₩ 20,500을 FESTIO Pay로 결제하고 O2O 픽업 예약을 생성하시겠습니까?")) {
      alert("🎉 결제가 성공적으로 처리되었습니다! 주문 접수 현황판(#O2O-4093)이 즉시 생성되었으며 픽업 바코드가 발급되었습니다.");
    }
  });