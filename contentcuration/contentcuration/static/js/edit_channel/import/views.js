var Backbone = require("backbone");
var _ = require("underscore");
var BaseViews = require("edit_channel/views");
var Models = require("edit_channel/models");
require("import.less");
var stringHelper = require("edit_channel/utils/string_helper");

var ImportModalView = BaseViews.BaseModalView.extend({
    template: require("./hbtemplates/import_modal.handlebars"),

    initialize: function(options) {
        _.bindAll(this, "close_importer");
        this.callback = options.callback;
        this.parent_view = options.parent_view;
        this.modal = true;
        this.render();
        this.import_view = new ImportView({
            el: this.$(".modal-body"),
            callback: this.callback,
            modal : this,
            model:this.model
        });
    },

    render: function() {
        this.$el.html(this.template());
        $("body").append(this.el);
        this.$(".modal").modal({show: true});
        this.$(".modal").on("hide.bs.modal", this.close);
    },
    close_importer:function(collection, resolve){
      this.callback(collection);
      this.close();
      resolve("Success!");
    }
});


var ImportView = BaseViews.BaseListView.extend({
    template: require("./hbtemplates/import_dialog.handlebars"),
    callback:null,
    initialize: function(options) {
        _.bindAll(this, 'import_content');
        this.modal = options.modal;
        this.other_channels = window.access_channels.clone();
        this.other_channels.remove(window.current_channel);
        this.callback = options.callback;
        this.render();
    },
    events: {
      "click #import_content_submit" : "import_content"
    },
    render: function() {
        this.$el.html(this.template({
            is_empty:this.other_channels.length===0
        }));
        var channel_collection = new Models.ContentNodeCollection();
        this.other_channels.forEach(function(channel){
            var node = channel.get_root("main_tree");
            node.set({title:channel.get("name")});
            channel_collection.add(node);
        });
        if(this.other_channels.length>0){
            this.importList = new ImportList({
                model : null,
                el:$("#import_from_channel_box"),
                is_channel: true,
                collection :  channel_collection,
                parent_node_view:null,
                container :this
            });
        }

    },
    update_count:function(){
        var list = this.$el.find(".to_import");
        if(list.length ===0){
            $("#import_content_submit").text("Select content to import...");
            $("#import_content_submit").attr("disabled", "disabled");
        }else{
            $("#import_content_submit").text("IMPORT");
            $("#import_content_submit").removeAttr("disabled");
        }
        var totalCount = 0;
        list.each(function(index, entry){
            totalCount += $(entry).data("data").model.get("metadata").total_count + 1;
        });
        var data = this.importList.get_metadata();
        totalCount -= data.count;
        this.$("#import_file_count").html(totalCount + " Topic" + ((totalCount == 1)? ", " : "s, ") + data.count + " Resource" + ((data.count == 1)? "   " : "s   ") + stringHelper.format_size(data.size));
    },
    import_content:function(){
        var self = this;
        this.display_load("Importing Content...", function(resolve, reject){
            try{
                var checked_items = self.$el.find(".to_import");
                var copyCollection = new Models.ContentNodeCollection();
                for(var i = 0; i < checked_items.length; i++){
                    copyCollection.add($(checked_items[i]).data("data").model);
                }
                var promise = new Promise(function(resolve1, reject1){
                    copyCollection.duplicate(self.model, resolve1, reject1);
                });
                promise.then(function(collection){
                    self.close_importer(collection, resolve);
                }).catch(function(error){
                    reject(error);
                });

            }catch(error){
                reject(error);
            }
        });
    },
    close_importer:function(collection, resolve){
        if(this.modal){
            this.modal.close_importer(collection, resolve);
        }else{
            this.callback(collection);
            this.remove();
            resolve("Success!");
        }
    }
});

var ImportList = BaseViews.BaseListView.extend({
    template: require("./hbtemplates/import_list.handlebars"),
    initialize: function(options) {
        this.is_channel = options.is_channel;
        this.collection = options.collection;
        this.container = options.container;
        this.metadata = {"count": 0, "size": 0};
        this.parent_node_view = options.parent_node_view;
        this.render();
    },
    render: function() {
        this.views = [];
        this.$el.html(this.template({
            node : this.model,
            is_channel:this.is_channel
        }));
        this.load_content();
    },
    load_content:function(){
        var self = this;
        this.collection.forEach(function(entry){
            var item_view = new ImportItem({
                containing_list_view: self,
                model: entry,
                is_channel : self.is_channel,
                selected: (self.parent_node_view)? self.parent_node_view.selected : false,
            });
            self.$el.find(".import-list").first().append(item_view.el);
            self.views.push(item_view);
        });
    },
    check_all_items:function(checked){
        this.views.forEach(function(entry){
            entry.check_item(checked);
            entry.set_disabled(checked);
            if(entry.subcontent_view){
                entry.subcontent_view.check_all_items(checked);
            }

        });
    },
    update_count:function(){
        if(this.parent_node_view){
            this.parent_node_view.update_count();
        }else{
            this.container.update_count();
        }
    },
    get_metadata:function(){
        var self = this;
        this.metadata = {"count" : 0, "size":0};
        this.views.forEach(function(entry){
            self.metadata.count += entry.metadata.count;
            self.metadata.size += entry.metadata.size;
        });
        return this.metadata;
    }
});

var ImportItem = BaseViews.BaseListNodeItemView.extend({
    template: require("./hbtemplates/import_list_item.handlebars"),
    tagName: "li",
    className: "import_list_item",
    indent: 0,
    'id': function() {
        return "import_item_" + this.model.get("id");
    },

    initialize: function(options) {
        _.bindAll(this, 'toggle', 'handle_check');
        this.containing_list_view = options.containing_list_view;
        this.is_channel = options.is_channel;
        this.collection = new Models.ContentNodeCollection();
        this.selected = options.selected;

        this.metadata = {"count": 0, "size": 0};
        this.render();
    },
    events: {
        'click .tog_folder' : 'toggle',
        'click >.import_checkbox' : 'handle_check'
    },
    render: function() {
        this.$el.html(this.template({
            node:this.model.toJSON(),
            isfolder: this.model.get("kind").toLowerCase() == "topic",
            is_channel:this.is_channel
        }));
        this.$el.data("data", this);
        this.$el.find(".import_checkbox").prop("checked", this.selected);
        this.set_disabled(this.selected);
    },
    toggle:function(){
        event.stopPropagation();
        event.preventDefault();
        this.load_subfiles();
        var el =  this.$el.find("#menu_toggle_" + this.model.id);
        var collapsed_symbol = (this.is_channel)? "glyphicon-menu-right" : "glyphicon-triangle-top";
        var expanded_symbol = (this.is_channel)? "glyphicon-menu-down" : "glyphicon-triangle-bottom";

        if(el.hasClass(collapsed_symbol)){
            this.$el.find("#" + this.id() +"_sub").slideDown();
            el.removeClass(collapsed_symbol).addClass(expanded_symbol);
        }else{
            this.$el.find("#" + this.id() +"_sub").slideUp();
            el.removeClass(expanded_symbol).addClass(collapsed_symbol);
        }
    },
    handle_check:function(){
        this.selected =  this.$("#" + this.id() + "_check").is(":checked");
        if(this.selected){
            this.$el.addClass("to_import");
            this.metadata = {"count" : this.model.get("metadata").resource_count, "size": this.model.get("metadata").resource_size};
        }else{
            this.$el.removeClass("to_import");
            this.metadata = {"count" : 0, "size": 0};
        }
        if(this.subcontent_view){
            this.subcontent_view.check_all_items(this.selected);
        }
        this.update_count();
    },
    check_item:function(checked){
        if(this.$el.hasClass("to_import")){
            this.$el.removeClass("to_import");
        }
        this.metadata = (checked)?
                        {"count": this.model.get("metadata").resource_count, "size": this.model.get("metadata").resource_size}
                        : {"count": 0, "size": 0}
        this.$("#" + this.id() + "_check").prop("checked", checked);
        this.$("#" + this.id() + "_count").text(this.model.get("metadata").resource_count);
        this.$("#" + this.id() + "_count").css("visibility", (checked)?"visible" : "hidden" );
        this.selected = checked;
    },
    load_subfiles:function(){
        if(this.collection.length === 0){
             this.collection = this.collection.get_all_fetch(this.model.get("children"));
             this.collection.sort_by_order();
             this.subcontent_view = new ImportList({
                model : this.model,
                el: $("#" + this.id() + "_sub"),
                is_channel: false,
                collection: this.collection,
                parent_node_view:this,
                container: this.containing_list_view.container
            });
        }
    },
    set_disabled:function(isDisabled){
        if(isDisabled){
            this.$el.addClass("disabled");
            this.$("#" + this.id() + "_check").attr("disabled", "disabled");
        }else{
            this.$el.removeClass("disabled");
            this.$("#" + this.id() + "_check").removeAttr("disabled");
        }
    },
    update_count:function(){
        if(this.subcontent_view){
            this.metadata = this.subcontent_view.get_metadata();
        }
        this.$("#" + this.id() + "_count").css("visibility", (this.metadata.count === 0)? "hidden" : "visible");
        this.$("#" + this.id() + "_count").text(this.metadata.count);
        this.containing_list_view.update_count();
    }
});

module.exports = {
    ImportModalView: ImportModalView,
    ImportView:ImportView
}