const mongoose = require('mongoose');
const User = mongoose.model('User');
const Store = mongoose.model('Store');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

// File upload
const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if (isPhoto) {
      next(null, true);
    } else {
      next({ message: 'That filetpye isn\'t allowed!' }, false);
    }
  }
};

exports.homePage = (req, res) => {
    console.log(req.name);
    res.render('index');
};

// addStore Middleware
exports.addStore = (req, res) => {
    res.render('editStore', { title: 'Add Store'});
};

// Upload READing middleware 
exports.upload = multer(multerOptions).single('photo');

// Resize middleware
exports.resize = async (req, res, next) => {
  // check if there is no new file to resize
  if (!req.file) {
    next(); // skip to the next middleware
    return;
  }
  // console.log(req.file);
  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;
  // resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  // write to memory 
  await photo.write(`./public/uploads/${req.body.photo}`);
  // once we have written the photo to the filesystem, keep going!
  next();
};

// CreateStore middleware
exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await (new Store(req.body)).save();
  // AWAIT until store is saved to mongoDB database, then move onto next line of code
  await store.save();
  // flash middleware
  req.flash('success', `Successfully Created ${store.name}. Care to leave a review?`); 
  res.redirect(`/store/${store.slug}`);
};

// getStores middleware
exports.getStores = async (req, res) => {
  // Pagination values
  const page = req.params.page || 1;
  const limit = 4;
  const skip = (page * limit) - limit;
  // Querry the database for the list of all stores 
  const storesPromise = Store
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc'});
  // Querry the number of stores 
  const countPromise = Store.count();
  // Return array of promises 
  const [stores, count] = await Promise.all([storesPromise, countPromise]);
  // upper bound for # pages
  const pages = Math.ceil(count / limit);

  // Check if page exists 
  if (!stores.length&& skip) {
    req.flash('info', `Hey! You asked for ${page}. But that doesnt exit. So I put you on page ${pages}`);
    res.redirect(`/stores/page/${pages}`);
    return;
  }

  res.render('stores', { title: 'Stores', stores, page, pages, count });
};

// getStoreBySlug middleware
exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
  // if slug doesnt exist, MOVE ONTO NEXT MIDDLEWARE(FROM APP.JS)
  if (!store) return next();
  res.render('store', {store, title: store.name });
};

// 
const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error('You must own the store in order to edit!');
  }
};

// editStore Middleware
exports.editStore = async (req, res) => {
  // 1. Find store given ID
  const store = await Store.findOne({ _id: req.params.id });
  // 2. confirm they are the owner of the store 
  confirmOwner(store, req.user);
  // 3. Render out edit form so user can update store
  res.render('editStore', { title: `Edit ${store.name}`, store });
};

// updateStore middleware
exports.updateStore = async (req, res) => {
  // set the location data to be a point
  req.body.location.type = 'Point';
  // Find and upate the store
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, // Return the new store instead of the old one
    runValidators: true
  }).exec();
  req.flash('success', `Successfully updated ${store.name}. <a href="/stores/${store.slug}">View Store</a>`);
  // redirect them to the store and tell it it worked 
  res.redirect(`/stores/${store._id}/edit`);
};

// getStoresByTags middleware
exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };

  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  const [ tags, stores ] = await Promise.all([tagsPromise, storesPromise]);
  
  res.render('tag', { tags, title: 'Tags', tag, stores });  
};

// Searchstores Middleware
exports.searchStores = async (req, res) => {
  const stores = await Store
  // First find stores that match
  .find({
    $text: {
      $search: req.query.q
    }
  }, {
    score: { $meta: 'textScore' }
  })
  // Then sort them
  .sort({
    score: { $meta: 'textScore' }
  })
  // Limit to only 5
  .limit(5);
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 10000 // 10km
      }
    }
  };

  const stores = await Store.find(q).select('slug name description location photo').limit(10);
  res.json(stores);
};

// Map all stores middleware
exports.mapPage = (req, res) => {
  res.render('map', {title: 'Map' });
};

// 
exports.heartStore = async (req, res) => {
  // Get a list (an array) of the users hearts 
  const hearts = req.user.hearts.map(obj => obj.toString());
  // Check if the hearts is already in the array, if it is pull(take it out), if not, addToSet(put it in)
  const operator = hearts.includes(req.params.id) ? '$pull': '$addToSet';
  // Found current user
  const user = await User
  .findByIdAndUpdate(
    req.user._id,
    { [operator]: { hearts: req.params.id }}, // update hearts property
    { new: true } // return 'new' updated user
  );
  res.json(user);
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({ 
    _id: {$in: req.user.hearts }  // find any stores where _id is an array 
  });
  res.render('stores', { title: 'Hearted Stores', stores });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  res.render('topStores', { stores, title: '⭐ Top Stores!'});
};