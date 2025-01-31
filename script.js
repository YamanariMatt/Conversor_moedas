const taxas = {
    BRL: { USD: 0.20, EUR: 0.18, JPY: 29.5 },
    USD: { BRL: 5.00, EUR: 0.91, JPY: 147.0 },
    EUR: { BRL: 5.50, USD: 1.10, JPY: 161.5 },
    JPY: { BRL: 0.034, USD: 0.0068, EUR: 0.0062 }
};

function converter(event) {
    event.preventDefault();
    let valor = parseFloat(document.getElementById("valor").value);
    let moedaOrigem = document.getElementById("moedaOrigem").value;
    let moedaDestino = document.getElementById("moedaDestino").value;

    if (moedaOrigem === moedaDestino) {
        document.getElementById("resultado").innerText = "Escolha moedas diferentes!";
        return;
    }

    if (isNaN(valor) || valor <= 0) {
        document.getElementById("resultado").innerText = "Digite um valor válido!";
        return;
    }

    let taxaConversao = taxas[moedaOrigem][moedaDestino];
    let convertido = (valor * taxaConversao).toFixed(2);
    document.getElementById("resultado").innerText = `Resultado: ${convertido} ${moedaDestino}`;
}