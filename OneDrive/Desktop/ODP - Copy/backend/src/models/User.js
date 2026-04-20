const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const deletedQueryFilter = function deletedQueryFilter() {
  const options = this.getOptions ? this.getOptions() : {};

  if (options.withDeleted) {
    return;
  }

  if (options.onlyDeleted) {
    this.where({ isDeleted: true });
    return;
  }

  this.where({ isDeleted: { $ne: true } });
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 60
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false
    },
    role: {
      type: String,
      enum: ['user', 'support', 'finance', 'admin', 'super_admin'],
      default: 'user'
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deletionReason: {
      type: String,
      default: ''
    },
    mobileNumber: {
      type: String,
      trim: true,
      default: ''
    },
    profilePicture: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ role: 1, isDeleted: 1, createdAt: -1 });
userSchema.index({ role: 1, isBlocked: 1, isDeleted: 1 });

userSchema.query.withDeleted = function withDeleted() {
  this.setOptions({ ...(this.getOptions ? this.getOptions() : {}), withDeleted: true });
  return this;
};

userSchema.query.onlyDeleted = function onlyDeleted() {
  this.setOptions({ ...(this.getOptions ? this.getOptions() : {}), withDeleted: true, onlyDeleted: true });
  return this;
};

userSchema.pre(/^find/, deletedQueryFilter);
userSchema.pre('countDocuments', deletedQueryFilter);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
