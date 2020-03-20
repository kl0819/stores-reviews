const axios = require('axios');
const dompurify = require('dompurify');

function searchResultsHTML(stores) {
  return stores.map(store => {
    return `
      <a href="/store/${store.slug}" class="search__result"> 
        <strong>${store.name}</strong>
      </a>
    `;
  }).join('');
};  

function typeAhead(search) {
  // No search on page, dont run this function at all 
  if (!search) return;

  const searchInput = search.querySelector('input[name="search"]');
  const searchResults = search.querySelector('.search__results');

  searchInput.on('input', function() {
    // if there is no value, quit it!
    if (!this.value){
      searchResults.style.display = 'none';
      return; // stop!
    }

    // show the search results
    searchResults.style.display = 'block';
    // to hit our endpoint
    axios
      .get(`api/v1/search?q=${this.value}`)
      .then(res => {
        if (res.data.length) {
          searchResults.innerHTML = dompurify.sanitize(searchResultsHTML(res.data));
          return;
        } 
        // Feedback: nothing came back
        searchResults.innerHTML = dompurify.sanitize(`<div class="search__result">No Results for ${this.value}</div>`);
      })
      .catch(err => {
        console.error(err);
      });
  });

  // Handle Keyboard inputs
  searchInput.on('keyup', (e) => {
    // if they aren't pressing up, down or enter
    if (![38, 40, 13].includes(e.keyCode)) {
      return; // skip it
    }

    const activeClass = 'search__result--active';
    const current = search.querySelector(`.${activeClass}`);
    const items = search.querySelectorAll('.search__result');
    let next;
    // if theres an active + 👇, go to the next OR the first element 
    if (e.keyCode === 40 && current) {
      next = current.nextElementSibling || items[0];
    } 
    // 👇, go to the first element
    else if (e.keyCode === 40) {
      next = items[0];
    } 
    // if there's an active + 👆, go to the above element OR last one
    else if (e.keyCode === 38 && current) {
      next = current.previousElementSibling || items[items.length - 1]
    } 
    // 👆, go to the last element
    else if (e.keyCode === 38) {
      next = items[items.length - 1];
    } 
    // if there's an current element with a href + :ENTER, go to it
    else if (e.keyCode === 13 && current.href) {
      window.location = current.href;
      return;
    }
    // Remove activeClass from the former current one
    if (current) {
      current.classList.remove(activeClass);
    }
    // add active class to the CURRENT
    next.classList.add(activeClass);
  });
}

export default typeAhead;