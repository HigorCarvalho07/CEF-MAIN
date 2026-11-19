document.addEventListener('DOMContentLoaded', () => {
    const recoverForm = document.getElementById('recover-form');
    
    if (recoverForm) {
        recoverForm.addEventListener('submit', (event) => {
            event.preventDefault();
            alert('Se o e-mail existir em nossa base, você receberá um link de recuperação em instantes (Protótipo).');
            window.location.href = 'login.html'; // Volta para o login
        });
    }
});