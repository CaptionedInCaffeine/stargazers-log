// script.js — fetch events.json and render an accessible list of starred repositories
// Features:
// - Robust fetch with timeout and error handling
// - Uses aria-busy and role/status updates for screen readers
// - Safe DOM updates using textContent/createElement to avoid XSS
// - Graceful handling of empty or unexpected data shapes

(async function () {
  const repoCountEl = document.getElementById('repo-count');
  const repoListEl = document.getElementById('repo-list');
  const statusEl = document.getElementById('status');

  if (!repoListEl || !repoCountEl || !statusEl) {
    console.warn('Expected DOM elements not found — aborting script.');
    return;
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', !!isError);
  }

  function setRepoCount(n) {
    // Provide a descriptive phrase for screen readers
    repoCountEl.textContent = n === 1 ? '1 repository' : `${n} repositories`;
  }

  function renderRepoList(items) {
    // Prefer semantic list markup
    const ul = document.createElement('ul');
    ul.className = 'repo-list__items';

    items.forEach((repo) => {
      const li = document.createElement('li');
      li.className = 'repo';

      const title = repo.full_name || repo.name || repo.title || 'Repository';
      const url = repo.html_url || repo.url || '#';
      const desc = repo.description || repo.body || '';

      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = title;

      li.appendChild(a);

      if (desc) {
        const p = document.createElement('p');
        p.textContent = desc;
        li.appendChild(p);
      }

      ul.appendChild(li);
    });

    repoListEl.innerHTML = '';
    repoListEl.appendChild(ul);
  }

  function safeParseJson(payload) {
    // Guard against non-array top-level shapes like { items: [...] }
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    // Try to detect common shapes from GitHub-like results
    if (payload && Array.isArray(payload.repositories)) return payload.repositories;
    return null;
  }

  async function fetchWithTimeout(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(id);
      return resp;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  async function load() {
    try {
      repoListEl.setAttribute('aria-busy', 'true');
      setStatus('Loading repository log...');

      const resp = await fetchWithTimeout('events.json', 10000);
      if (!resp.ok) throw new Error(`Network response was ${resp.status}`);

      const payload = await resp.json();
      const items = safeParseJson(payload);

      if (!items) {
        setRepoCount(0);
        setStatus('No recently starred repositories found.');
        repoListEl.innerHTML = '<p>No recent stars.</p>';
        return;
      }

      if (items.length === 0) {
        setRepoCount(0);
        setStatus('No recently starred repositories found.');
        repoListEl.innerHTML = '<p>No recent stars.</p>';
        return;
      }

      // Render list
      renderRepoList(items);
      setRepoCount(items.length);
      setStatus(`Loaded ${items.length} repositories.`);
    } catch (err) {
      console.error('Failed to load events.json', err);
      setRepoCount(0);
      setStatus('Failed to load repository log. Please try again later.', true);

      // Provide a retry button for users who can interact
      repoListEl.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = 'Unable to load repositories.';
      repoListEl.appendChild(p);

      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Retry';
      retry.className = 'retry-button';
      retry.addEventListener('click', () => {
        load();
      });
      repoListEl.appendChild(retry);
    } finally {
      repoListEl.removeAttribute('aria-busy');
    }
  }

  // Kick off initial load
  load();
})();
