function autocomplete(input, latInput, lngInput) {
  if (!input) return; // skip this fn from running fi there is no input on the page
  const dropdown = new google.maps.places.Autocomplete(input);

  dropdown.addListener('place_changed', () => {
    const place = dropdown.getPlace();
    latInput.value = place.geometry.location.lat();
    lngInput.value = place.geometry.location.lng();
  });

  // if someone hits enter on the address field, dont submit the form 
  input.on('keyddown', (e) => {
    if (e.keycode === 13) e.preventDefault();
  });
}

export default autocomplete;