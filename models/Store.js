const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs'); // Url friendly slugs

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name!'
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [{
      type: Number, 
      require: 'You Must Supply Coordinates',
    }],
    address: {
      type: String,
      required: 'You Must Suppy an Address!'
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author'
  }
}, {
  // enable virtuals 
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Define Indexes
storeSchema.index({
  name: 'text',
  description: 'text' 
});

// map indexes
storeSchema.index({
  location: '2dsphere'
});

storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    next(); // skip it
    return; // stop funciton from running 
  }
  // Set the slug property before the save happens 
  this.slug = slug(this.name);
  // find other stores that have slug of name, name-1, name-2
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');

  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });

  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length+1}`;
  }

  next();
});

storeSchema.statics.getTagsList = function () {
  // data pipeline for sorting
  return this.aggregate([
    { $unwind: '$tags'},
    { $group: { _id: '$tags', count: {$sum: 1 } }},
    { $sort: { count: -1 }}
  ]);
};

storeSchema.statics.getTopStores = function () {
  // return the promise 
  return this.aggregate([
    /* Look up Stores and populate their reviews
     *  @from: <collection to join>, mongoDB takes name of model Review -> (r)eview(s)
     *  @localField: <field from the input documents>
     *  @foreignField: <field from the documents of the 'from' collection
     *  @as: <output array field>
     */
    { $lookup: { 
      from: 'reviews', 
      localField: '_id', 
      foreignField: 'store', 
      as: 'reviews'
    }},

    // filter for only items that have 2 or more reviews
    // reviews[1] exists 
    { $match: { 'reviews.1': { $exists: true }}},
    
    // add the average review field/property
    // ** mongDB 3.2.x: passes only specified fields **
    { $project: {
      photo: '$$ROOT.photo',
      name: '$$ROOT.name',
      reviews: '$$ROOT.reviews',
      slug: '$$ROOT.slug',
      averageRating: { $avg: '$reviews.rating' }  
    }},
    
    // sort it by our new field, highest reviews first 
    { $sort: { averageRating: -1 }},
    // limit to at most 10 
    { $limit: 10}
  ]);
};

// Find reviews where the stores _id property === reviews store property
storeSchema.virtual('reviews', {
  ref: 'Review',        // what model to link
  localField: '_id',    // which field on the store?
  foreignField: 'store' // which field on the review?
});

function autopopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);


module.exports = mongoose.model('Store', storeSchema);
