/* customers.html — 고객 · 진행 단계 화면만 따로 (시연용). ?ind=insurance 처럼 업종을 붙이면 바로 시작 */
Sales.mount(document.getElementById('root'), { template: new URLSearchParams(location.search).get('ind') });
