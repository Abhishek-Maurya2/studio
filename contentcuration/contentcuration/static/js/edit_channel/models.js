var Backbone = require("backbone");
var _= require("underscore");
var mail_helper = require("edit_channel/utils/mail");

/**** BASE MODELS ****/
var BaseModel = Backbone.Model.extend({
	root_list:null,
	urlRoot: function() {
		return window.Urls[this.root_list]();
	},
	toJSON: function() {
	  var json = Backbone.Model.prototype.toJSON.apply(this, arguments);
	  json.cid = this.cid;
	  return json;
	}
});

var BaseCollection = Backbone.Collection.extend({
	list_name:null,
	url: function() {
		return window.Urls[this.list_name]();
	},
	save: function(callback) {
        Backbone.sync("update", this, {url: this.model.prototype.urlRoot()});
	}
});

/**** USER-CENTERED MODELS ****/
var UserModel = BaseModel.extend({
	root_list : "user-list",
	defaults: {
		first_name: "Guest"
    },
    fetch_by_email:function(email){
		/* TODO-BLOCKER: Better to only fetch email looking for */
    	var collection = new UserCollection();
    	collection.fetch({async:false});
    	return collection.findWhere({email: email});
    },
    send_invitation_email:function(email, channel, callback){
    	mail_helper.send_mail(channel, email, callback);
    },
    get_clipboard:function(){
    	return new ContentNodeModel(this.get("clipboard_tree"));
    }
});

var UserCollection = BaseCollection.extend({
	model: UserModel,
	list_name:"user-list",

	/* TODO: would be better to fetch all values at once */
    get_all_fetch: function(ids){
    	var to_fetch = new UserCollection();
    	var self = this;
    	ids.forEach(function(id){
			var model = self.get({'id': id});
    		if(!model){
    			model = self.add({'id':id});
    			model.fetch({async:false});
    		}
    		to_fetch.add(model);
    	});
    	return to_fetch;
    }

});

var InvitationModel = BaseModel.extend({
	root_list : "invitation-list",
	defaults: {
		first_name: "Guest"
    },
    resend_invitation_email:function(channel, callback){
    	mail_helper.send_mail(channel, this.get("email"), callback);
    }
});

var InvitationCollection = BaseCollection.extend({
	model: InvitationModel,
	list_name:"invitation-list",

	/* TODO: would be better to fetch all values at once */
    get_all_fetch: function(ids){
    	var to_fetch = new InvitationCollection();
    	var self = this;
    	ids.forEach(function(id){
			var model = self.get({'id': id});
    		if(!model){
    			model = self.add({'id':id});
    			model.fetch({async:false});
    		}
    		to_fetch.add(model);
    	});
    	return to_fetch;
    }

});

/**** CHANNEL AND CONTENT MODELS ****/
var ContentNodeModel = BaseModel.extend({
	root_list:"contentnode-list",
	defaults: {
		title:"Untitled",
		children:[],
		tags:[],
		metadata:{
			"resource_size":0,
			"resource_count":0,
			"max_sort_order":1
		}
    },

	move:function(target_parent, allow_duplicate, sort_order){
		this.set({parent: target_parent.id,sort_order:sort_order}, {validate:true});
		this.save(this.attributes, {async:false, validate:false}); //Save any other values
	},
	create_file:function(){
		this.get("files").forEach(function(file){
			if(file.attributes){
				var data = file.pick("file_size", "contentnode", "preset");
				file.save(data,{async:false});
			}
		});
	}
});

var ContentNodeCollection = BaseCollection.extend({
	model: ContentNodeModel,
	list_name:"contentnode-list",
	highest_sort_order: 1,

	save: function(resolve, reject) {
		var self = this;
        Backbone.sync("update", this, {
        	url: this.model.prototype.urlRoot(),
        	success: function(data){
        		var fetch_list = [];
        		data.forEach(function(entry){
        			if(entry.kind != "topic"){
        				fetch_list.push(entry.id);
        			}
				});
				self.get_all_fetch(fetch_list).forEach(function(node){
					node.create_file();
				});
        		resolve(true);
        	},
        	error:function(obj, error){
        		reject(error);
        	}
        });
	},

   /* TODO: would be better to fetch all values at once */
    get_all_fetch: function(ids){
  //   	console.log("PERFORMANCE models.js: starting get_all_fetch...", ids);
		// var start = new Date().getTime();
    	var to_fetch = new ContentNodeCollection();
    	var self = this;
    	ids.forEach(function(id){
			var model = self.get({'id': id});
    		if(!model){
    			model = self.add({'id':id});
    			model.fetch({async:false});
    		}
    		to_fetch.add(model);
    	});
    	// console.log("PERFORMANCE models.js: get_all_fetch end (time = " + (new Date().getTime() - start) + ")");
    	return to_fetch;
    },
    sort_by_order:function(){
    	this.comparator = function(node){
    		return node.get("sort_order");
    	};
    	this.sort();
    	this.highest_sort_order = (this.length > 0)? this.at(this.length - 1).get("sort_order") : 1;
    },
    duplicate:function(target_parent, resolve, reject){
    	var copied_list = [];
    	this.forEach(function(node){
    		copied_list.push(node.get("id"));
    	});
		var sort_order =(target_parent) ? target_parent.get("metadata").max_sort_order + 1 : 1;
        var parent_id = target_parent.get("id");

        var data = {"node_ids": copied_list.join(" "),
                    "sort_order": sort_order,
                    "target_parent": parent_id};
        $.ajax({
        	method:"POST",
            url: window.Urls.duplicate_nodes(),
            data:  JSON.stringify(data),
            success: function(data) {
                copied_list = JSON.parse(data).node_ids.split(" ");
                var copiedCollection = new ContentNodeCollection();
    			copiedCollection.get_all_fetch(copied_list);
    			resolve(copiedCollection);
            },
            error:function(e){
            	reject(e);
            }
        });
    },
    move:function(target_parent, sort_order, resolve, reject){
    	this.forEach(function(model){
			model.set({
				parent: target_parent.id,
				sort_order:++sort_order
			});
    	});
    	var self  = this;
    	var promise = new Promise(function(resolve, reject){
    		self.save(resolve, reject);
		});
		promise.then(function(){
			resolve(true);
		}).catch(function(error){
			reject(error);
		});
	}
});

var ChannelModel = BaseModel.extend({
    //idAttribute: "channel_id",
	root_list : "channel-list",
	defaults: {
		name: " ",
		editors: [],
		pending_editors: [],
		author: "Anonymous",
		license_owner: "No license found",
		description:" "
    },

    get_root:function(tree_name){
    	return new ContentNodeModel(this.get(tree_name));
    },

    publish:function(callback){
        var data = {"channel_id": this.get("id")};
        $.ajax({
        	method:"POST",
            url: window.Urls.publish_channel(),
            data:  JSON.stringify(data),
            success:function(){
            	callback();
            }
        });
    }
});

var ChannelCollection = BaseCollection.extend({
	model: ChannelModel,
	list_name:"channel-list"
});

var TagModel = BaseModel.extend({
	root_list : "contenttag-list",
	defaults: {
		tag_name: "Untagged"
    }
});

var TagCollection = BaseCollection.extend({
	model: TagModel,
	list_name:"contenttag-list",
	get_or_fetch:function(id){
		var tag = this.get(id);
		if(!tag){
			tag = new TagModel({"id":id});
			tag.fetch({async:false});
			if(tag){
				this.add(tag);
			}
			this.fetch({async:false})
		}
		return tag;
	}
});

/**** MODELS SPECIFIC TO FILE NODES ****/
var FileModel = BaseModel.extend({
	root_list:"file-list"
});

var FileCollection = BaseCollection.extend({
	model: FileModel,
	list_name:"file-list",
	get_or_fetch: function(data){
		var newCollection = new FileCollection();
		newCollection.fetch({
			traditional:true,
			data: data
		});
		var file = newCollection.findWhere(data);
    	return file;
    }
});

var FormatPresetModel = BaseModel.extend({
	root_list:"formatpreset-list",
	attached_format: null
});

var FormatPresetCollection = BaseCollection.extend({
	model: FormatPresetModel,
	list_name:"formatpreset-list",
	sort_by_order:function(){
    	this.comparator = function(preset){
    		return preset.get("order");
    	};
    	this.sort();
    }
});


/**** PRESETS AUTOMATICALLY GENERATED UPON FIRST USE ****/
var FileFormatModel = Backbone.Model.extend({
	root_list: "fileformat-list",
	defaults: {
		extension:"invalid"
    }
});

var FileFormatCollection = BaseCollection.extend({
	model: FileFormatModel,
	list_name:"fileformat-list",
});

var LicenseModel = BaseModel.extend({
	root_list:"license-list",
	defaults: {
		license_name:"Unlicensed",
		exists: false
    }
});

var LicenseCollection = BaseCollection.extend({
	model: LicenseModel,
	list_name:"license-list",

    get_default:function(){
    	return this.findWhere({license_name:"CC-BY"});
    }
});

var ContentKindModel = BaseModel.extend({
	root_list:"contentkind-list",
	defaults: {
		kind:"topic"
    },
    get_presets:function(){
    	return window.formatpresets.where({kind: this.get("kind")})
    }
});

var ContentKindCollection = BaseCollection.extend({
	model: ContentKindModel,
	list_name:"contentkind-list",

    get_default:function(){
    	return this.findWhere({kind:"topic"});
    }
});

function send_mail(data){

}


module.exports = {
	ContentNodeModel: ContentNodeModel,
	ContentNodeCollection: ContentNodeCollection,
	ChannelModel: ChannelModel,
	ChannelCollection: ChannelCollection,
	TagModel: TagModel,
	TagCollection:TagCollection,
	FileFormatCollection:FileFormatCollection,
	LicenseCollection:LicenseCollection,
	FileCollection: FileCollection,
	FileModel: FileModel,
	FormatPresetModel: FormatPresetModel,
	FormatPresetCollection: FormatPresetCollection,
	ContentKindModel: ContentKindModel,
	ContentKindCollection : ContentKindCollection,
	UserModel:UserModel,
	UserCollection:UserCollection,
	InvitationModel: InvitationModel,
	InvitationCollection: InvitationCollection
}
