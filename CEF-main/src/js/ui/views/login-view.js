document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Impede o recarregamento da página
            window.location.href = 'index.html'; // Redireciona para o sistema
        });
    }
});