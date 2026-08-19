fetch('http://localhost:3000/api/v1/daily-recommend/today').then(r=>r.text()).then(t=>console.log(t.substring(0,800)));
