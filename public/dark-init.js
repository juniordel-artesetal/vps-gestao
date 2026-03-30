try {
  if (localStorage.getItem('dark-mode') === 'true') {
    document.documentElement.classList.add('dark')
  }
} catch(e) {}
