import '../sass/style.scss';

import { $, $$ } from './modules/bling';
import autocomplete from './modules/autocomplete';
import typeAhead from './modules/typeAhead';
import makeMap from './modules/map';
import ajaxHeart from './modules/hearts';

autocomplete($('#address'), $('#lat'), $('#lng') );

typeAhead($('.search'));

makeMap($('#map'));

// select all forms
const heartForms = $$('form.heart');
// when forms are submitted call ajaxheart
heartForms.on('submit', ajaxHeart);
