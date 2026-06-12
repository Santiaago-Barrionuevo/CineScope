const API_KEY  = '280698d36184b87d6499542e93ab656a';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL  = 'https://image.tmdb.org/t/p/w500';
const LANG     = 'es-AR';


const state = {
  type:        'movie',   
  query:       '',
  page:        1,
  totalPages:  1,
  genre:       '',
  year:        '',
  sort:        'popularity.desc',
  favorites:   JSON.parse(localStorage.getItem('cs_favs') || '[]'),
  genres:      { movie: [], tv: [] },
};

const grid           = document.getElementById('grid');
const pagination     = document.getElementById('pagination');
const resultsInfo    = document.getElementById('resultsInfo');
const searchInput    = document.getElementById('searchInput');
const btnSearch      = document.getElementById('btnSearch');
const genreFilter    = document.getElementById('genreFilter');
const yearFilter     = document.getElementById('yearFilter');
const sortFilter     = document.getElementById('sortFilter');
const btnClear       = document.getElementById('btnClear');
const favsCount      = document.getElementById('favsCount');
const btnFavs        = document.getElementById('btnFavs');
const favsPanel      = document.getElementById('favsPanel');
const favsPanelClose = document.getElementById('favsPanelClose');
const favsOverlay    = document.getElementById('favsOverlay');
const favsList       = document.getElementById('favsList');
const btnClearFavs   = document.getElementById('btnClearFavs');
const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const modalContent   = document.getElementById('modalContent');
const navTabs        = document.querySelectorAll('.nav-tab');
const btnHome        = document.getElementById('btnHome');



const apiFetch = async (endpoint, params = {}) => {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('language', LANG);
  Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};


const loadGenres = async () => {
  try {
    const [movies, tvs] = await Promise.all([
      apiFetch('/genre/movie/list'),
      apiFetch('/genre/tv/list'),
    ]);
    state.genres.movie = movies.genres;
    state.genres.tv    = tvs.genres;
    renderGenreFilter();
  } catch { /* silencioso */ }
};

const renderGenreFilter = () => {
  const list = state.type === 'tv' ? state.genres.tv : state.genres.movie;
  genreFilter.innerHTML = '<option value="">Todos los géneros</option>' +
    list.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  genreFilter.value = state.genre;
};


const buildYearFilter = () => {
  const current = new Date().getFullYear();
  let opts = '<option value="">Todos los años</option>';
  for (let y = current; y >= 1970; y--) {
    opts += `<option value="${y}">${y}</option>`;
  }
  yearFilter.innerHTML = opts;
  yearFilter.value = state.year;
};


const fetchContent = async (page = 1) => {
  showLoading();
  state.page = page;

  try {
    let data;

    if (state.query) {
      const searchType = state.type === 'trending' ? 'multi' : state.type;
      data = await apiFetch(`/search/${searchType}`, {
        query: state.query,
        page,
      });
    } else if (state.type === 'trending') {
      data = await apiFetch('/trending/all/week', { page });
    } else {
      
      const yearKey = state.type === 'movie' ? 'primary_release_year' : 'first_air_date_year';
      data = await apiFetch(`/discover/${state.type}`, {
        sort_by:    state.sort,
        with_genres: state.genre,
        [yearKey]:  state.year,
        page,
        'vote_count.gte': 50,
      });
    }

    state.totalPages = Math.min(data.total_pages, 500);
    resultsInfo.textContent = data.total_results
      ? `${data.total_results.toLocaleString()} resultados`
      : '';

    if (!data.results?.length) { showEmpty(); pagination.innerHTML = ''; return; }

    renderGrid(data.results);
    renderPagination();
  } catch (err) {
    console.error(err);
    showError();
    pagination.innerHTML = '';
    resultsInfo.textContent = '';
  }
};



const getPosterURL = (path) => path ? `${IMG_URL}${path}` : null;

const getYear = (item) => {
  const d = item.release_date || item.first_air_date || '';
  return d.slice(0, 4) || '—';
};

const getTitle = (item) => item.title || item.name || 'Sin título';

const getRating = (v) => v ? `★ ${v.toFixed(1)}` : '—';

const isFav = (id) => state.favorites.some(f => f.id === id);

const cardHTML = (item) => {
  const poster = getPosterURL(item.poster_path);
  const imgTag = poster
    ? `<img class="card__poster" src="${poster}" alt="${getTitle(item)}" loading="lazy" />`
    : `<div class="card__poster card__poster--placeholder">🎬</div>`;

  return `
    <article class="card" data-id="${item.id}" data-media="${item.media_type || state.type}">
      ${imgTag}
      <div class="card__body">
        <p class="card__title">${getTitle(item)}</p>
        <div class="card__meta">
          <span>${getYear(item)}</span>
          <span class="card__rating">${getRating(item.vote_average)}</span>
        </div>
      </div>
      <button class="card__fav ${isFav(item.id) ? 'active' : ''}" data-id="${item.id}" aria-label="Favorito">★</button>
    </article>
  `;
};

const renderGrid = (results) => {
  grid.innerHTML = results.map(cardHTML).join('');
  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card__fav')) return;
      openModal(Number(card.dataset.id), card.dataset.media);
    });
  });
  grid.querySelectorAll('.card__fav').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.card');
      toggleFavFromGrid(Number(btn.dataset.id), card.dataset.media);
    });
  });
};



const renderPagination = () => {
  const { page, totalPages } = state;
  pagination.innerHTML = `
    <button id="btnPrev" ${page === 1 ? 'disabled' : ''}>← Anterior</button>
    <span>Página ${page} de ${totalPages}</span>
    <button id="btnNext" ${page === totalPages ? 'disabled' : ''}>Siguiente →</button>
  `;
  document.getElementById('btnPrev').addEventListener('click', () => fetchContent(page - 1));
  document.getElementById('btnNext').addEventListener('click', () => fetchContent(page + 1));
};



const showLoading = () => {
  grid.innerHTML = `<div class="state-msg"><span class="emoji">⏳</span>Cargando...</div>`;
  pagination.innerHTML = '';
};

const showEmpty = () => {
  grid.innerHTML = `<div class="state-msg"><span class="emoji">🔍</span>Sin resultados para esa búsqueda.</div>`;
  resultsInfo.textContent = '';
};

const showError = () => {
  grid.innerHTML = `<div class="state-msg"><span class="emoji">⚠️</span>Algo salió mal. Intentalo de nuevo.</div>`;
};



const openModal = async (id, mediaType = 'movie') => {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  modalContent.innerHTML = `<div class="state-msg"><span class="emoji">⏳</span>Cargando...</div>`;
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const item = await apiFetch(`/${type}/${id}`);
    const poster = getPosterURL(item.poster_path);
    const title  = item.title || item.name;
    const year   = (item.release_date || item.first_air_date || '').slice(0, 4);
    const runtime = item.runtime
      ? `${item.runtime} min`
      : item.episode_run_time?.[0]
        ? `${item.episode_run_time[0]} min/ep`
        : '—';

    const imgTag = poster
      ? `<img class="modal__poster" src="${poster}" alt="${title}" />`
      : `<div class="modal__poster modal__poster--placeholder">🎬</div>`;

    modalContent.innerHTML = `
      <div class="modal__inner">
        ${imgTag}
        <div class="modal__info">
          <span class="modal__type">${type === 'movie' ? 'Película' : 'Serie'}</span>
          <h2 class="modal__title">${title}</h2>
          ${item.tagline ? `<p class="modal__tagline">"${item.tagline}"</p>` : ''}
          <div class="modal__rating">
            <span class="modal__stars">★</span>
            <span class="modal__score">${item.vote_average?.toFixed(1) || '—'}</span>
            <span class="modal__votes">(${item.vote_count?.toLocaleString() || 0} votos)</span>
          </div>
          ${item.genres?.length ? `
            <div class="modal__genres">
              ${item.genres.map(g => `<span class="genre-tag">${g.name}</span>`).join('')}
            </div>` : ''}
          ${item.overview ? `<p class="modal__overview">${item.overview}</p>` : ''}
          <div class="modal__rows">
            <div class="modal__row">
              <span class="modal__label">Año</span>
              <span class="modal__value">${year || '—'}</span>
            </div>
            <div class="modal__row">
              <span class="modal__label">Duración</span>
              <span class="modal__value">${runtime}</span>
            </div>
            ${item.status ? `
            <div class="modal__row">
              <span class="modal__label">Estado</span>
              <span class="modal__value">${item.status}</span>
            </div>` : ''}
            ${item.number_of_seasons ? `
            <div class="modal__row">
              <span class="modal__label">Temporadas</span>
              <span class="modal__value">${item.number_of_seasons}</span>
            </div>` : ''}
          </div>
          <button class="modal__fav-btn ${isFav(id) ? 'active' : ''}" data-id="${id}" data-type="${type}">
            ${isFav(id) ? '★ En favoritos' : '☆ Agregar a favoritos'}
          </button>
        </div>
      </div>
    `;

    modalContent.querySelector('.modal__fav-btn').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const favItem = {
        id:     item.id,
        title,
        year,
        type,
        poster: item.poster_path,
      };
      toggleFav(favItem);
      const active = isFav(id);
      btn.classList.toggle('active', active);
      btn.textContent = active ? '★ En favoritos' : '☆ Agregar a favoritos';
      const cardBtn = grid.querySelector(`.card__fav[data-id="${id}"]`);
      if (cardBtn) cardBtn.classList.toggle('active', active);
    });

  } catch (err) {
    console.error(err);
    modalContent.innerHTML = `<div class="state-msg"><span class="emoji">⚠️</span>Error al cargar.</div>`;
  }
};

const closeModal = () => {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
};



const saveFavs = () => localStorage.setItem('cs_favs', JSON.stringify(state.favorites));

const toggleFav = (item) => {
  if (isFav(item.id)) {
    state.favorites = state.favorites.filter(f => f.id !== item.id);
  } else {
    state.favorites.push(item);
  }
  saveFavs();
  updateFavsCount();
};

const toggleFavFromGrid = (id, mediaType) => {
  if (isFav(id)) {
    state.favorites = state.favorites.filter(f => f.id !== id);
    saveFavs();
    updateFavsCount();
    const cardBtn = grid.querySelector(`.card__fav[data-id="${id}"]`);
    if (cardBtn) cardBtn.classList.remove('active');
    if (favsPanel.classList.contains('open')) renderFavsPanel();
  } else {
    const card = grid.querySelector(`.card[data-id="${id}"]`);
    const title  = card?.querySelector('.card__title')?.textContent || '';
    const year   = card?.querySelector('.card__meta span')?.textContent || '';
    const imgSrc = card?.querySelector('.card__poster')?.src || '';
    const posterPath = imgSrc.includes('tmdb') ? imgSrc.replace(IMG_URL, '') : null;
    toggleFav({ id, title, year, type: mediaType || state.type, poster: posterPath });
    const cardBtn = grid.querySelector(`.card__fav[data-id="${id}"]`);
    if (cardBtn) cardBtn.classList.add('active');
    if (favsPanel.classList.contains('open')) renderFavsPanel();
  }
};

const updateFavsCount = () => {
  favsCount.textContent = state.favorites.length;
};

const renderFavsPanel = () => {
  if (!state.favorites.length) {
    favsList.innerHTML = `<p class="favs-empty">No tenés favoritos todavía.</p>`;
    return;
  }
  favsList.innerHTML = state.favorites.map(f => {
    const poster = f.poster ? `${IMG_URL}${f.poster}` : null;
    const imgTag = poster
      ? `<img class="fav-item__poster" src="${poster}" alt="${f.title}" />`
      : `<div class="fav-item__poster" style="display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🎬</div>`;
    return `
      <div class="fav-item" data-id="${f.id}" data-type="${f.type}">
        ${imgTag}
        <div class="fav-item__info">
          <p class="fav-item__title">${f.title}</p>
          <p class="fav-item__year">${f.year || '—'} · ${f.type === 'movie' ? 'Película' : 'Serie'}</p>
        </div>
        <button class="fav-item__remove" data-id="${f.id}" aria-label="Quitar">✕</button>
      </div>
    `;
  }).join('');

  favsList.querySelectorAll('.fav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.fav-item__remove')) return;
      closeFavsPanel();
      openModal(Number(item.dataset.id), item.dataset.type);
    });
  });

  favsList.querySelectorAll('.fav-item__remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      state.favorites = state.favorites.filter(f => f.id !== id);
      saveFavs();
      updateFavsCount();
      renderFavsPanel();
      const cardBtn = grid.querySelector(`.card__fav[data-id="${id}"]`);
      if (cardBtn) cardBtn.classList.remove('active');
    });
  });
};

const openFavsPanel = () => {
  renderFavsPanel();
  favsPanel.classList.add('open');
  favsOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
};

const closeFavsPanel = () => {
  favsPanel.classList.remove('open');
  favsOverlay.classList.remove('open');
  document.body.style.overflow = '';
};


const doSearch = () => {
  state.query = searchInput.value.trim();
  state.page  = 1;
  fetchContent(1);
};

btnSearch.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

genreFilter.addEventListener('change', () => { state.genre = genreFilter.value; fetchContent(1); });
yearFilter.addEventListener('change',  () => { state.year  = yearFilter.value;  fetchContent(1); });
sortFilter.addEventListener('change',  () => { state.sort  = sortFilter.value;  fetchContent(1); });

btnClear.addEventListener('click', () => {
  searchInput.value  = '';
  genreFilter.value  = '';
  yearFilter.value   = '';
  sortFilter.value   = 'popularity.desc';
  state.query = '';
  state.genre = '';
  state.year  = '';
  state.sort  = 'popularity.desc';
  fetchContent(1);
});

navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    navTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.type  = tab.dataset.type;
    state.query = '';
    state.genre = '';
    state.year  = '';
    state.page  = 1;
    searchInput.value = '';
    genreFilter.value = '';
    yearFilter.value  = '';
    renderGenreFilter();
    fetchContent(1);
  });
});

btnHome.addEventListener('click', (e) => {
  e.preventDefault();
  state.query = '';
  searchInput.value = '';
  fetchContent(1);
});

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

btnFavs.addEventListener('click', openFavsPanel);
favsPanelClose.addEventListener('click', closeFavsPanel);
favsOverlay.addEventListener('click', closeFavsPanel);
btnClearFavs.addEventListener('click', () => {
  state.favorites = [];
  saveFavs();
  updateFavsCount();
  renderFavsPanel();
  grid.querySelectorAll('.card__fav').forEach(btn => btn.classList.remove('active'));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeFavsPanel(); }
});



updateFavsCount();
buildYearFilter();
loadGenres().then(() => fetchContent(1));