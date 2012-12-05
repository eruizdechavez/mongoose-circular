// Dependencies
var mongoose = require('mongoose'),
	async = require('async');

// Connect to Mongoose
mongoose.connect('mongodb://localhost:27017/circular');

var Schema = mongoose.Schema,
	ObjectId = Schema.Types.ObjectId;

// Schema definitions
var PostSchema = new Schema({
	title: {
		type: String,
		'default': ''
	},
	content: {
		type: String,
		'default': ''
	}
});
var AttachmentSchema = new Schema({
	fileName: {
		type: String,
		'default': ''
	}
});

// Circular reference definitions
PostSchema.add({
	attachments: [{
		type: ObjectId,
		ref: 'Attachment'
	}]
});
AttachmentSchema.add({
	posts: [{
		type: ObjectId,
		ref: 'Post'
	}]
});

// A couple of methods to save references inside the documents by using only
// the _id instead of creating a subdocument.
PostSchema.methods.attach = function(attachment, callback) {
	var post = this;
	this.attachments.push(attachment);
	this.save(function(err) {
		attachment.posts.push(post);
		attachment.save(callback);
	});
};
AttachmentSchema.methods.share = function(post, callback) {
	var attachment = this;
	this.posts.push(post);
	this.save(function(err) {
		post.attachments.push(attachment);
		post.save(callback);
	});
};

// Models definition
var Post = mongoose.model('Post', PostSchema, 'posts');
var Attachment = mongoose.model('Attachment', AttachmentSchema, 'attachments');

// Go parallel!
async.parallel({
	post: function(callback) {
		console.log('creating a post');
		var p = new Post({
			title: 'Test post (' + Date.now() + ')',
			content: 'Test post (' + Date.now() + ')'
		});
		p.save(callback);
	},
	attachment: function(callback) {
		console.log('creating an attachment');
		var a = new Attachment({
			fileName: 'test_' + Date.now() + '.txt'
		});
		a.save(callback);
	}
}, function(err, res) {
	// Once we have a new post and a new attachment, create a relation on each one,
	// this is only a demo of having the reference of each other but it is not required.
	res.post[0].attach(res.attachment[0], function(err, res) {
		// Dump the current data, just to see if it is working ;)
		async.series([function(callback) {
			// Read all our posts and their attachments
			Post.find().populate('attachments').exec(function(err, posts) {
				if (err) {
					return callback(err);
				}

				posts.forEach(function(post) {
					console.log('Post ' + post.title + ' has ' + post.attachments.length + ' attachment(s):');
					post.attachments.forEach(function(attachment) {
						console.log('- Filename: ' + attachment.fileName);
					});
				});
				callback();
			});
		}, function(callback) {
			// Read all our attachments and their posts
			Attachment.find().populate('posts').exec(function(err, attachments) {
				if (err) {
					return callback(err);
				}
				attachments.forEach(function(attachment) {
					console.log('Attachment ' + attachment.fileName + ' is shared in ' + attachment.posts.length + ' post(s):');
					attachment.posts.forEach(function(post) {
						console.log('- Post: ' + post.title);
					});
				});
				callback();
			});
		}], function(err) {
			mongoose.disconnect();
		});
	});
});
