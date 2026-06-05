const options = {
    series: [{
      name: '실시간 인파 밀도 (명/㎡)',
      data: [1.2, 4.8, 2.1, 0.8, 1.5]
    }],
    chart: {
      height: 250,
      type: 'radar',
      toolbar: { show: false }
    },
    title: {
      text: '구역별 단위면적당 인파 강도'
    },
    xaxis: {
      categories: ['메인광장', '무대진입로', '푸드트럭라인', '물품보관소', '게이트외곽']
    },
    colors: ['#ff3e1d']
  };
  const chart = new ApexCharts(document.querySelector("#dangerStatsChart"), options);
  chart.render();