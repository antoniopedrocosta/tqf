(function () {
  "use strict";

  var CHAPTERS = window.QF_CHAPTERS || [];
  var STORAGE_PREFIX = "qf:";

  function storageKey(parts) {
    return STORAGE_PREFIX + parts.join(":");
  }

  function getItem(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* storage unavailable (private mode, quota) — fail silently */
    }
  }

  function removeKeysWithPrefix(prefix) {
    try {
      var toRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) toRemove.push(k);
      }
      toRemove.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
  }

  function slugify(title) {
    return title
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function nl2br(s) {
    return escapeHtml(s).replace(/\n/g, "<br>");
  }

  // ---------- Progress ----------

  function chapterChecklistProgress(ci) {
    var ch = CHAPTERS[ci];
    var total = ch.checklist.length;
    var done = 0;
    for (var j = 0; j < total; j++) {
      if (getItem(storageKey(["check", ci, j]), "0") === "1") done++;
    }
    return { done: done, total: total };
  }

  function updateGlobalProgress() {
    var done = 0, total = 0;
    CHAPTERS.forEach(function (ch, ci) {
      var p = chapterChecklistProgress(ci);
      done += p.done;
      total += p.total;
    });
    var pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById("qf-progress-fill").style.width = pct + "%";
    document.getElementById("qf-progress-label").textContent =
      pct + "% da checklist concluída (" + done + "/" + total + " itens)";
  }

  // ---------- Nav ----------

  function renderNav() {
    var list = document.getElementById("qf-nav-list");
    list.innerHTML = "";
    CHAPTERS.forEach(function (ch, ci) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.index = ci;
      btn.id = "qf-nav-btn-" + ci;

      var label = document.createElement("span");
      label.textContent = ch.title.replace(/^Cap[ií]tulo\s+\d+\s*---\s*/, "").replace(/^Epílogo\s*---\s*/, "");

      var kicker = ch.title.match(/^(Capítulo\s+\d+|Epílogo)/);
      var prefix = kicker ? kicker[1] : "";
      label.textContent = (prefix ? prefix + " — " : "") + label.textContent;

      var badge = document.createElement("span");
      badge.className = "qf-nav-badge";
      var p = chapterChecklistProgress(ci);
      badge.textContent = p.total ? (p.done + "/" + p.total) : "";
      badge.id = "qf-nav-badge-" + ci;

      btn.appendChild(label);
      btn.appendChild(badge);
      btn.addEventListener("click", function () {
        location.hash = "#" + slugify(ch.title);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function setActiveNav(ci) {
    CHAPTERS.forEach(function (_, i) {
      var btn = document.getElementById("qf-nav-btn-" + i);
      if (btn) btn.classList.toggle("active", i === ci);
    });
  }

  // ---------- Assistants ----------

  var PARADIGM_QUESTIONS = [
    {
      q: "Como vês a realidade que queres estudar?",
      options: [
        { v: "A", t: "Existe de forma objetiva, exterior a quem a observa, e pode ser medida com instrumentos suficientemente rigorosos." },
        { v: "B", t: "É construída e reconstruída através dos significados, interpretações e interações entre as pessoas." }
      ]
    },
    {
      q: "O que valorizas mais quando dizes que um estudo é rigoroso?",
      options: [
        { v: "A", t: "A possibilidade de generalizar os resultados estatisticamente a outros contextos." },
        { v: "B", t: "A capacidade de compreender em profundidade a complexidade e as particularidades de um contexto específico." }
      ]
    },
    {
      q: "Recorrendo à metáfora agrícola: que terreno escolherias para o teu projeto?",
      options: [
        { v: "A", t: "Uma monocultura cuidadosamente planeada e otimizada, orientada para a uniformidade e a previsibilidade." },
        { v: "B", t: "Um terreno diversificado, aberto à coexistência de diferentes elementos e à emergência do inesperado." }
      ]
    }
  ];

  function renderParadigmAssistant(container) {
    var wrap = document.createElement("div");
    wrap.className = "qf-assistant";
    var h = document.createElement("h2");
    h.textContent = "Assistente: que paradigma está a orientar o meu projeto?";
    wrap.appendChild(h);

    var answers = {};
    PARADIGM_QUESTIONS.forEach(function (item, qi) {
      var qDiv = document.createElement("div");
      qDiv.className = "qf-assistant-q";
      var qText = document.createElement("p");
      qText.className = "q-text";
      qText.textContent = (qi + 1) + ". " + item.q;
      qDiv.appendChild(qText);

      var optsDiv = document.createElement("div");
      optsDiv.className = "qf-assistant-options";
      item.options.forEach(function (opt, oi) {
        var label = document.createElement("label");
        var input = document.createElement("input");
        input.type = "radio";
        input.name = "qf-paradigm-q" + qi;
        input.value = opt.v;
        input.addEventListener("change", function () {
          answers[qi] = opt.v;
          maybeShowResult();
        });
        label.appendChild(input);
        var span = document.createElement("span");
        span.textContent = opt.t;
        label.appendChild(span);
        optsDiv.appendChild(label);
      });
      qDiv.appendChild(optsDiv);
      wrap.appendChild(qDiv);
    });

    var result = document.createElement("div");
    result.className = "qf-assistant-result";
    wrap.appendChild(result);

    function maybeShowResult() {
      if (Object.keys(answers).length < PARADIGM_QUESTIONS.length) return;
      var a = 0, b = 0;
      Object.keys(answers).forEach(function (k) {
        if (answers[k] === "A") a++; else b++;
      });
      var html;
      if (a > b) {
        html = "<strong>As tuas respostas apontam para o paradigma positivista.</strong> " +
          "Estás a tratar a realidade social como algo objetivo e exterior, e a medir o rigor pela capacidade de generalizar. " +
          "É o equivalente a escolher a agricultura intensiva do conhecimento: uniformizar condições, controlar variáveis, maximizar a replicabilidade. " +
          "Nada de errado nisso — só vale a pena confirmares que a tua questão de investigação e os teus métodos de recolha de dados são coerentes com esta escolha.";
      } else if (b > a) {
        html = "<strong>As tuas respostas apontam para o paradigma interpretativista / construtivista.</strong> " +
          "Estás a tratar a realidade social como algo construído na interação entre pessoas, e o rigor como compreensão em profundidade de um contexto. " +
          "É o terreno onde a investigação qualitativa se move com maior naturalidade — o que te leva diretamente ao Capítulo 4, para escolheres a abordagem (estudo de caso, etnografia, grounded theory, fenomenologia ou narrativa) mais ajustada à tua pergunta.";
      } else {
        html = "<strong>As tuas respostas estão divididas entre os dois paradigmas.</strong> " +
          "Isso normalmente significa que a pergunta ontológica de fundo ainda não está clarificada. Vale a pena voltar ao início do Capítulo 1 e perguntar, sem pressa: a realidade que quero estudar existe independentemente de quem a observa, ou é construída na interação entre pessoas? A resposta a essa pergunta, e só ela, deve orientar o resto.";
      }
      result.innerHTML = html;
      result.classList.add("show");
    }

    container.appendChild(wrap);
  }

  var METHOD_OPTIONS = [
    {
      v: "caso",
      t: "Um fenómeno delimitado — uma organização, uma comunidade, um evento — estudado em profundidade, no seu contexto real.",
      name: "Estudo de caso",
      explain: "É a cultura certa quando o interesse está centrado num caso delimitado, combinando frequentemente várias fontes de dados sobre esse mesmo caso (Yin, 2018)."
    },
    {
      v: "etnografia",
      t: "O significado partilhado de uma cultura ou prática social, observada por dentro, ao longo do tempo — não apenas um retrato pontual.",
      name: "Etnografia",
      explain: "Exige presença prolongada no terreno e observação participante, para compreender uma cultura ou prática social a partir de dentro (Hammersley & Atkinson, 2019)."
    },
    {
      v: "gt",
      t: "Como as pessoas lidam com uma experiência ou problema, construindo uma explicação processual a partir dos próprios dados — ainda não existe uma teoria satisfatória sobre isto.",
      name: "Grounded theory (teoria fundamentada)",
      explain: "Ajusta-se a perguntas que procuram construir, a partir dos dados e não de uma teoria prévia, uma explicação de como as pessoas lidam com uma experiência (Charmaz, 2014)."
    },
    {
      v: "feno",
      t: "Como é, subjetivamente, viver uma experiência específica em primeira pessoa — mais do que o contexto social à sua volta.",
      name: "Fenomenologia",
      explain: "Escolhe-se quando o que interessa é a estrutura da experiência vivida em primeira pessoa de um fenómeno específico (Smith et al., 2009)."
    },
    {
      v: "narrativa",
      t: "Como uma pessoa organiza e dá sentido à sua própria vida ao contar a sua história — a forma do relato importa tanto como o conteúdo.",
      name: "Investigação narrativa",
      explain: "Escolhe-se quando o que importa é a forma como as pessoas organizam e dão sentido às suas vidas através da narrativa (Clandinin & Connelly, 2000)."
    }
  ];

  function renderMethodAssistant(container) {
    var wrap = document.createElement("div");
    wrap.className = "qf-assistant";
    var h = document.createElement("h2");
    h.textContent = "Assistente: qual das cinco culturas se ajusta ao meu terreno?";
    wrap.appendChild(h);

    var qDiv = document.createElement("div");
    qDiv.className = "qf-assistant-q";
    var qText = document.createElement("p");
    qText.className = "q-text";
    qText.textContent = "O que queres compreender melhor com o teu projeto?";
    qDiv.appendChild(qText);

    var optsDiv = document.createElement("div");
    optsDiv.className = "qf-assistant-options";
    var result = document.createElement("div");
    result.className = "qf-assistant-result";

    METHOD_OPTIONS.forEach(function (opt) {
      var label = document.createElement("label");
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "qf-method-q";
      input.value = opt.v;
      input.addEventListener("change", function () {
        result.innerHTML = "<strong>" + opt.name + "</strong> parece a cultura mais ajustada ao teu terreno. " + opt.explain +
          " Mesmo assim, lê a secção “Cinco culturas, cinco terrenos” deste capítulo antes de decidires de vez — a escolha deve vir sempre da tua pergunta, não da familiaridade prévia com um método.";
        result.classList.add("show");
      });
      label.appendChild(input);
      var span = document.createElement("span");
      span.textContent = opt.t;
      label.appendChild(span);
      optsDiv.appendChild(label);
    });

    qDiv.appendChild(optsDiv);
    wrap.appendChild(qDiv);
    wrap.appendChild(result);
    container.appendChild(wrap);
  }

  // ---------- Chapter rendering ----------

  function renderChapter(ci) {
    var ch = CHAPTERS[ci];
    var main = document.getElementById("qf-main");
    main.innerHTML = "";

    var kickerMatch = ch.title.match(/^(Capítulo\s+\d+|Epílogo)\s*---\s*(.*)$/);
    var kicker = document.createElement("p");
    kicker.className = "qf-chapter-kicker";
    kicker.textContent = kickerMatch ? kickerMatch[1] : "";
    main.appendChild(kicker);

    var h1 = document.createElement("h1");
    h1.className = "qf-chapter-title";
    h1.textContent = kickerMatch ? kickerMatch[2] : ch.title;
    main.appendChild(h1);

    var intro = document.createElement("p");
    intro.className = "qf-intro";
    intro.textContent = ch.intro;
    main.appendChild(intro);

    // Paradigm assistant goes right after the intro of Chapter 1
    if (/^Capítulo\s+1\s*---/.test(ch.title)) {
      renderParadigmAssistant(main);
    }
    // Method assistant goes right after the intro of Chapter 4
    if (/^Capítulo\s+4\s*---/.test(ch.title)) {
      renderMethodAssistant(main);
    }

    if (ch.exercises && ch.exercises.length) {
      var exSection = document.createElement("div");
      exSection.className = "qf-section";
      var exH2 = document.createElement("h2");
      exH2.textContent = "Exercícios práticos";
      exSection.appendChild(exH2);

      ch.exercises.forEach(function (ex, ei) {
        var card = document.createElement("div");
        card.className = "qf-exercise";
        var h3 = document.createElement("h3");
        h3.textContent = (ei + 1) + ". " + ex.label;
        card.appendChild(h3);
        var p = document.createElement("p");
        p.innerHTML = nl2br(ex.body);
        card.appendChild(p);

        var ta = document.createElement("textarea");
        ta.placeholder = "Escreve aqui a tua resposta...";
        var key = storageKey(["ex", ci, ei]);
        ta.value = getItem(key, "");
        var hint = document.createElement("div");
        hint.className = "qf-save-hint";
        hint.textContent = "Guardado neste navegador.";
        var saveTimer;
        ta.addEventListener("input", function () {
          setItem(key, ta.value);
          hint.classList.add("show");
          clearTimeout(saveTimer);
          saveTimer = setTimeout(function () { hint.classList.remove("show"); }, 1500);
        });
        card.appendChild(ta);
        card.appendChild(hint);
        exSection.appendChild(card);
      });
      main.appendChild(exSection);
    }

    if (ch.checklist && ch.checklist.length) {
      var clSection = document.createElement("div");
      clSection.className = "qf-section";
      var clH2 = document.createElement("h2");
      clH2.textContent = "Checklist rápido";
      clSection.appendChild(clH2);

      var ul = document.createElement("ul");
      ul.className = "qf-checklist";
      ch.checklist.forEach(function (item, ii) {
        var li = document.createElement("li");
        var key = storageKey(["check", ci, ii]);
        var checked = getItem(key, "0") === "1";
        if (checked) li.classList.add("checked");

        var input = document.createElement("input");
        input.type = "checkbox";
        var id = "qf-check-" + ci + "-" + ii;
        input.id = id;
        input.checked = checked;
        input.addEventListener("change", function () {
          setItem(key, input.checked ? "1" : "0");
          li.classList.toggle("checked", input.checked);
          updateGlobalProgress();
          var badge = document.getElementById("qf-nav-badge-" + ci);
          var p = chapterChecklistProgress(ci);
          if (badge) badge.textContent = p.total ? (p.done + "/" + p.total) : "";
        });

        var label = document.createElement("label");
        label.setAttribute("for", id);
        label.textContent = item;

        li.appendChild(input);
        li.appendChild(label);
        ul.appendChild(li);
      });
      clSection.appendChild(ul);
      main.appendChild(clSection);
    }

    main.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Routing ----------

  function chapterIndexFromHash() {
    var hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!hash) return 0;
    for (var i = 0; i < CHAPTERS.length; i++) {
      if (slugify(CHAPTERS[i].title) === hash) return i;
    }
    return 0;
  }

  function route() {
    var ci = chapterIndexFromHash();
    setActiveNav(ci);
    renderChapter(ci);
    document.getElementById("qf-sidebar").classList.remove("open");
  }

  // ---------- Export ----------

  function exportAnswers() {
    var lines = [];
    lines.push("# The Qualitative Farmer — as minhas respostas");
    lines.push("");
    lines.push("Exportado em " + new Date().toLocaleString("pt-PT"));
    lines.push("");
    CHAPTERS.forEach(function (ch, ci) {
      lines.push("## " + ch.title.replace(/---/, "—"));
      lines.push("");
      if (ch.exercises && ch.exercises.length) {
        ch.exercises.forEach(function (ex, ei) {
          var val = getItem(storageKey(["ex", ci, ei]), "");
          lines.push("**" + (ei + 1) + ". " + ex.label + "**");
          lines.push("");
          lines.push(val.trim() ? val.trim() : "_(sem resposta)_");
          lines.push("");
        });
      }
      if (ch.checklist && ch.checklist.length) {
        lines.push("Checklist:");
        ch.checklist.forEach(function (item, ii) {
          var done = getItem(storageKey(["check", ci, ii]), "0") === "1";
          lines.push((done ? "- [x] " : "- [ ] ") + item);
        });
        lines.push("");
      }
    });
    var blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "the-qualitative-farmer-respostas.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---------- Init ----------

  document.addEventListener("DOMContentLoaded", function () {
    renderNav();
    updateGlobalProgress();
    route();

    window.addEventListener("hashchange", route);

    document.getElementById("qf-nav-toggle").addEventListener("click", function () {
      var sb = document.getElementById("qf-sidebar");
      var open = sb.classList.toggle("open");
      this.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.getElementById("qf-export-btn").addEventListener("click", exportAnswers);

    document.getElementById("qf-reset-btn").addEventListener("click", function () {
      if (confirm("Isto apaga todas as respostas e checklists guardadas neste navegador. Continuar?")) {
        removeKeysWithPrefix(STORAGE_PREFIX);
        route();
        renderNav();
        updateGlobalProgress();
      }
    });
  });
})();
