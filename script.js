const resultadoEl = document.getElementById("resultado");
const ultimoEl = document.getElementById("ultimoAtualizacao");
const moedaOrigemSelect = document.getElementById("moedaOrigem");
const moedaDestinoSelect = document.getElementById("moedaDestino");

const DEFAULT_SYMBOLS = ["AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD","BIF","BMD","BND","BOB","BRL","BSD","BTN","BWP","BYN","BZD","CAD","CDF","CHF","CLP","CNY","COP","CRC","CUC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP","ERN","ETB","EUR","FJD","FKP","GBP","GEL","GGP","GHS","GIP","GMD","GNF","GTQ","GYD","HKD","HNL","HRK","HTG","HUF","IDR","ILS","IMP","INR","IQD","IRR","ISK","JEP","JMD","JOD","JPY","KES","KGS","KHR","KMF","KPW","KRW","KWD","KYD","KZT","LAK","LBP","LKR","LRD","LSL","LYD","MAD","MDL","MGA","MKD","MMK","MNT","MOP","MRU","MUR","MVR","MWK","MXN","MYR","MZN","NAD","NGN","NIO","NOK","NPR","NZD","OMR","PAB","PEN","PGK","PHP","PKR","PLN","PYG","QAR","RON","RSD","RUB","RWF","SAR","SBD","SCR","SDG","SEK","SGD","SHP","SLL","SOS","SRD","SSP","STN","SVC","SYP","SZL","THB","TJS","TMT","TND","TOP","TRY","TTD","TWD","TZS","UAH","UGX","USD","UYU","UZS","VES","VND","VUV","WST","XAF","XCD","XDR","XOF","XPF","YER","ZAR","ZMW","ZWL"];

const CACHE_KEY_SYMBOLS = "cotacao_moedas_symbols";
const CACHE_KEY_RATES = "cotacao_moedas_rates";
const CACHE_TTL = 1000 * 60 * 10; // 10 min

function getCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed.timestamp || Date.now() - parsed.timestamp > CACHE_TTL) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.value;
    } catch {
        return null;
    }
}

function setCache(key, value) {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), value }));
}

function formatDate(data) {
    const d = new Date(data);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

async function obterSymbols() {
    const cached = getCache(CACHE_KEY_SYMBOLS);
    if (cached) return cached;

    try {
        const res = await fetch("https://economia.awesomeapi.com.br/json/all");
        if (!res.ok) throw new Error("Falha ao buscar símbolos");
        const data = await res.json();

        const symbolsSet = new Set();
        Object.values(data).forEach((item) => {
            if (item.code) symbolsSet.add(item.code);
            if (item.codein) symbolsSet.add(item.codein);
        });

        const symbols = Array.from(symbolsSet).sort();
        if (symbols.length === 0) throw new Error("Sem símbolos na resposta");

        setCache(CACHE_KEY_SYMBOLS, symbols);
        return symbols;
    } catch (err) {
        console.warn("Falha ao buscar símbolos API, usando fallback local", err);
        return DEFAULT_SYMBOLS.sort();
    }
}

async function carregarMoedas() {
    try {
        const symbols = await obterSymbols();
        moedaOrigemSelect.innerHTML = "";
        moedaDestinoSelect.innerHTML = "";

        for (const code of symbols) {
            moedaOrigemSelect.insertAdjacentHTML("beforeend", `<option value="${code}">${code}</option>`);
            moedaDestinoSelect.insertAdjacentHTML("beforeend", `<option value="${code}">${code}</option>`);
        }

        moedaOrigemSelect.value = symbols.includes("BRL") ? "BRL" : symbols[0];
        moedaDestinoSelect.value = symbols.includes("USD") ? "USD" : symbols[1] || symbols[0];
        ultimoEl.innerText = `Moedas carregadas (${symbols.length})`;
    } catch (err) {
        console.error(err);
        ultimoEl.innerText = "Não foi possível carregar todas as moedas. Usando fallback local.";
        const fixed = DEFAULT_SYMBOLS;
        moedaOrigemSelect.innerHTML = fixed.map(m => `<option value="${m}">${m}</option>`).join("");
        moedaDestinoSelect.innerHTML = fixed.map(m => `<option value="${m}">${m}</option>`).join("");
    }
}

async function fetchAwesome(pair) {
    const endpoint = `https://economia.awesomeapi.com.br/json/last/${pair}`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error("Falha ao consultar AwesomeAPI");
    const data = await res.json();
    return data;
}

function formatPair(base, destino) {
    return `${base}-${destino}`;
}

async function obterTaxa(base, destino) {
    if (base === destino) {
        return { rate: 1, date: new Date().toISOString(), fromCache: true };
    }

    const cache = getCache(CACHE_KEY_RATES);
    if (cache && cache.base === base && cache.destino === destino) {
        return { rate: cache.rate, date: cache.date, fromCache: true };
    }

    async function getBid(pair) {
        const data = await fetchAwesome(pair);
        const key = pair.replace("-", "");
        const quote = data[key];
        if (!quote || !quote.bid) {
            throw new Error(`Par não encontrado: ${pair}`);
        }
        return { bid: parseFloat(quote.bid), date: quote.create_date || new Date().toISOString() };
    }

    try {
        // tenta par direto: base-destino
        const pair = formatPair(base, destino);
        const quote = await getBid(pair);
        const rate = quote.bid;
        setCache(CACHE_KEY_RATES, { base, destino, rate, date: quote.date });
        return { rate, date: quote.date, fromCache: false };
    } catch {
        // tenta via BRL (cross-rate)
        if (base === "BRL" || destino === "BRL") {
            throw new Error("Par não disponível");
        }

        const fromBase = await getBid(formatPair(base, "BRL"));
        const fromDest = await getBid(formatPair(destino, "BRL"));
        const rate = fromBase.bid / fromDest.bid;
        const date = fromBase.date || fromDest.date;
        setCache(CACHE_KEY_RATES, { base, destino, rate, date });
        return { rate, date, fromCache: false };
    }
}

async function converter(event) {
    event.preventDefault();
    const valor = parseFloat(document.getElementById("valor").value);
    const moedaOrigem = moedaOrigemSelect.value;
    const moedaDestino = moedaDestinoSelect.value;

    if (moedaOrigem === moedaDestino) {
        resultadoEl.innerText = "Escolha moedas diferentes!";
        return;
    }
    if (isNaN(valor) || valor <= 0) {
        resultadoEl.innerText = "Digite um valor válido!";
        return;
    }

    resultadoEl.innerText = "Carregando cotação...";
    try {
        const data = await obterTaxa(moedaOrigem, moedaDestino);
        const convertido = (valor * data.rate).toFixed(2);
        resultadoEl.innerText = `Resultado: ${convertido} ${moedaDestino} (1 ${moedaOrigem} = ${data.rate.toFixed(6)} ${moedaDestino})`;
        ultimoEl.innerText = `Última atualização: ${formatDate(data.date)} ${data.fromCache ? "(cache)" : "(API)"}`;
    } catch (err) {
        resultadoEl.innerText = "Erro ao buscar cotação. Tente novamente.";
        ultimoEl.innerText = "";
        console.error(err);
    }
}

async function atualizarMoedas() {
    resultadoEl.innerText = "Atualizando lista de moedas...";
    try {
        localStorage.removeItem(CACHE_KEY_SYMBOLS);
        await carregarMoedas();
        resultadoEl.innerText = "Lista de moedas atualizada.";
    } catch {
        resultadoEl.innerText = "Falha ao atualizar moedas.";
    }
}

window.addEventListener("load", carregarMoedas);
