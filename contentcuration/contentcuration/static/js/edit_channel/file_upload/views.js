var Backbone = require("backbone");
var _ = require("underscore");
var BaseViews = require("edit_channel/views");
var Models = require("edit_channel/models");
var Dropzone = require("dropzone");
var get_cookie = require("utils/get_cookie");
require("file-uploader.less");
require("dropzone/dist/dropzone.css");
var stringHelper = require("edit_channel/utils/string_helper");
var browserHelper = require("edit_channel/utils/browser_functions");

var FileModalView = BaseViews.BaseModalView.extend({
    template: require("./hbtemplates/file_upload_modal.handlebars"),
    initialize: function(options) {
        _.bindAll(this, "close_file_uploader");
        this.callback = options.callback;
        this.parent_view = options.parent_view;
        this.render(this.close_file_uploader, {});
        this.file_upload_view = new FileUploadView({
            el: this.$(".modal-body"),
            parent_view : this.parent_view,
            callback: this.callback,
            container: this,
            model:this.model,
            onsave: options.onsave
        });
    },
    close_file_uploader:function(event){
        if(this.file_upload_view.views.length === 0){
            this.close();
        }else if(confirm("Unsaved Metadata Detected! Exiting now will"
            + " undo any new changes. \n\nAre you sure you want to exit?")){

            this.file_upload_view.views.forEach(function(view){
                view.clean_files();
            });
            this.close();
        }else{
            event.stopPropagation();
            event.preventDefault();
        }
    }
});

var FileUploadView = BaseViews.BaseListView.extend({
    template: require("./hbtemplates/file_upload.handlebars"),
    file_upload_template: require("./hbtemplates/file_upload_dropzone_item.handlebars"),
    callback:null,
    file_list : [],
    returnCollection: null,
    initialize: function(options) {
        _.bindAll(this, "file_uploaded",  "all_files_uploaded", "file_added", "file_removed", "go_to_upload_from_metadata","go_to_formats", "go_to_upload", "go_to_metadata","file_failed", "close_file_uploader");
        this.callback = options.callback;
        this.container = options.container;
        this.uploading = true;
        this.metadata = false;
        this.file_list = [];
        this.views=[];
        this.fileCollection = new Models.FileCollection();
        this.returnCollection = new Models.ContentNodeCollection();
        this.acceptedFiles = this.get_accepted_files();
        this.parent_view = options.parent_view;
        this.onsave = options.onsave;
        this.upload_in_progress = false;
        this.render();
    },
    events:{
      "click .go_to_formats" : "go_to_formats",
      "click .go_to_upload" : "go_to_upload",
      "click .go_to_metadata": "go_to_metadata",
      "click .go_to_upload_from_metadata":"go_to_upload_from_metadata"
    },
    get_accepted_files:function(){
        var list = [];
        window.formatpresets.forEach(function(preset){
            if(!preset.get("supplementary")){
                list.push(preset.get("associated_mimetypes"));
            }
        });
        return list.join(",");
    },
    render: function() {
        this.nodeCollection = new Models.ContentNodeCollection();
        this.$el.html(this.template({
            uploading:this.uploading,
            metadata:this.metadata
        }));

        if(this.uploading){
            // TODO parameterize to allow different file uploads depending on initialization.
            this.dropzone = new Dropzone(this.$("#dropzone").get(0), {
                clickable: ["#dropzone", ".fileinput-button"],
                acceptedFiles: this.acceptedFiles,
                url: window.Urls.file_upload(),
                previewTemplate:this.file_upload_template(),
                parallelUploads: Math.max(1, browserHelper.get_max_parallel_uploads() / 2),
                //autoQueue: false, // Make sure the files aren't queued until manually added
                previewsContainer: "#dropzone", // Define the container to display the previews
                headers: {"X-CSRFToken": get_cookie("csrftoken")}
            });
            this.dropzone.on("success", this.file_uploaded);

            // Only enable the submit upload files button once all files have finished uploading.
            this.dropzone.on("queuecomplete", this.all_files_uploaded);

            // Disable the submit upload files button if a new file is added to the queue.
            this.dropzone.on("addedfile", this.file_added);

            this.dropzone.on("removedfile", this.file_removed);
            this.dropzone.on("error", this.file_failed);
        }
        if(!this.metadata){
            this.load_content();
        }
    },
    load_content:function(){
        var list = this.$el.find(".file_list");
        var self = this;
        list.html("");
        var items = this.views;
        this.original_count = this.views.length;
        this.views = [];
        items.forEach(function(view){
            var new_format_item = new FormatItem({
                el:  view.$el,
                model: view.model,
                default_file: view.default_file,
                containing_list_view : self,
                thumbnail: view.thumbnail,
                presets : view.presets,
                initial : view.initial
            });
            self.views.push(new_format_item);
            list.append(new_format_item.el);
        });
        if(this.views.length > 0){
            this.enable_next();
        }

    },
    file_uploaded: function(file) {
        // console.log("FILE FOUND:", file);
        var new_file_data = {
            "data" : file,
            "filename": JSON.parse(file.xhr.response).filename
        }
        this.file_list.push(new_file_data);
        var fileModel = new Models.FileModel({id: JSON.parse(file.xhr.response).object_id});
        var presets = new Models.FormatPresetCollection();
        var self = this;
        fileModel.fetch({
            success:function(file_model){
                var kind = window.contentkinds.findWhere({kind: file_model.get("recommended_kind")});
                kind.get("associated_presets").forEach(function(preset){
                    presets.add(window.formatpresets.get(preset).clone());
                });
                self.nodeCollection.create_node_for_file(new_file_data.data.name.split(".")[0], file_model, new_file_data.data.size).then(function(createdNode){
                    var new_format_item = new FormatItem({
                        el:  $(file.previewTemplate),
                        model: createdNode,
                        default_file: fileModel,
                        containing_list_view : self,
                        thumbnail: $(file.previewTemplate).find(".thumbnail_img").attr("src"),
                        presets : presets,
                        initial:true,
                        inline:false,
                        update_models: false
                    });

                    self.views.push(new_format_item);
                    console.log("CHECKING PROGRESS");
                    if(!self.upload_in_progress){
                        self.enable_next();
                    }
                });
            }
        });
    },
    file_failed:function(file, error){
        $(file.previewTemplate).find(".dropzone_remove").css("display", "inline-block");
        console.log(error);
    },
    disable_submit: function() {
        this.$(".go_to_metadata").attr("disabled", "disabled");
        this.$(".go_to_metadata").text((this.check_completed()) ? "Upload in progress..." : "Assign formats to continue");
    },
    enable_submit: function() {
        this.$(".go_to_metadata").removeAttr("disabled");
        this.$(".go_to_metadata").text("EDIT METADATA");
    },
    disable_next:function(){
        this.$(".go_to_formats").attr("disabled", "disabled");
        this.$(".go_to_formats").text((this.upload_in_progress)? "Upload in progress..." : "Add files to continue");
        if (this.file_list.length === 0) {
            $("#new-files-separator").remove();
        }
    },
    enable_next:function(){
        if(this.file_list.length > 0){
            this.$(".go_to_formats").removeAttr("disabled");
            this.$(".go_to_formats").text("NEXT");
        }
    },
    all_files_uploaded: function() {
        console.log("ALL REACHED");
        this.upload_in_progress = false;
    },
    file_added: function(file) {
        if(this.original_count > 0 && this.original_count == this.views.length){
            $(file.previewTemplate).before("<hr id='new-files-separator'/>");
        }
        this.disable_next();
        this.upload_in_progress = true;
        this.$(".go_to_formats").text("Upload in progress...");
    },

    file_removed: function(file) {
        this.file_list.splice(this.file_list.indexOf(file), 1);
        if (this.file_list.length === 0) {
            this.disable_next();
        }
    },
    go_to_formats:function(){
        this.container.$("#formats_step_number").addClass("active_number");
        this.uploading = false;
        this.metadata = false;
        this.render();
        if(this.check_completed()){
            this.enable_submit();
        }
    },
    go_to_upload:function(){
        this.container.$("#formats_step_number").removeClass("active_number");
        this.container.$("#metadata_step_number").removeClass("active_number");
        this.uploading = true;
        this.metadata = false;
        this.render();
    },
    go_to_metadata:function(){
        this.container.$("#metadata_step_number").addClass("active_number");
        this.uploading = false;
        this.metadata = true;
        this.render();
        var self = this;
        this.views.forEach(function(view){
            self.returnCollection.add(view.submit_file());
        });
        var UploaderViews = require("edit_channel/uploader/views");
        this.metadata_view = new UploaderViews.EditMetadataView({
            el : $("#editmetadata_section"),
            collection: this.returnCollection,
            parent_view: this.parent_view,
            model: this.model,
            upload_files: true,
            new_content: false,
            onsave: this.onsave,
            onclose:this.close_file_uploader
        });
    },
    go_to_upload_from_metadata:function(){
        var self = this;
        this.views.forEach(function(view){
            view.model.set(self.returnCollection.get(view.model).attributes);
            var preset_collection = new Models.FormatPresetCollection();
            view.model.get("files").forEach(function(file){
                var new_preset = window.formatpresets.get({id: file.get("preset")});
                new_preset.attached_format = file;
                preset_collection.add(new_preset);
            })
            view.presets = preset_collection;
        });
        this.go_to_upload();
    },
    close_file_uploader:function(){
        this.container.close();
        $(".modal-backdrop").remove();
    },
    remove_view: function(view){
        this.views.splice(this.views.indexOf(this), 1);
        view.remove();
        if(this.views.length == 0){
            this.disable_next();
        }
    },
    check_completed:function(){
        var is_completed = true;
        this.views.forEach(function(view){
            is_completed = is_completed && !view.initial;
        });
        return is_completed;
    }
});

var FormatItem = BaseViews.BaseWorkspaceListNodeItemView.extend({
    template: require("./hbtemplates/file_upload_item.handlebars"),
    inline_template: require("./hbtemplates/file_upload_inline_item.handlebars"),
    className: "format_item row",
    files: [],
    format_views:[],
    indent: 0,
    'id': function() {
        return "format_item_" + this.model.filename;
    },

    initialize: function(options) {
        _.bindAll(this, 'assign_default_format', 'toggle_formats', 'update_name', 'enable_save'); //'remove_item',
        this.containing_list_view = options.containing_list_view;
        this.thumbnail = options.thumbnail;
        this.default_file = options.default_file;
        this.update_models = options.update_models;
        this.preview = options.preview;
        if(this.default_file){
            this.files.push(this.default_file);
        }
        this.initial = options.initial;
        this.presets = options.presets;
        this.inline = options.inline;
        this.files_to_delete=new Models.FileCollection();
        this.size = 0;
        this.render();
        this.$(".save_initial_format").attr("disabled", "disabled");
    },
    events: {
        'change .format_options_dropdown' : 'enable_save',
        'click .remove_from_dz ' : 'remove_item',
        'keyup .name_content_input': 'update_name',
        'paste .name_content_input': 'update_name',
        'change .format_options_dropdown' : "assign_default_format"
    },
    render: function() {
        this.presets.sort_by_order();
        if(!this.inline){
            this.$el.html(this.template({
                file:this.default_file,
                initial: this.initial,
                presets: this.presets.models,
                thumbnail:this.thumbnail,
                node: this.model,
                size: this.size
            }));
            if(this.initial){
                var preset_list = this.presets.where({supplementary:false});

                if(preset_list.length === 1){
                    this.$(".format_options_dropdown").val(preset_list[0].id);
                    this.assign_default_format();
                }
            }else{
                this.load_slots();
                this.render_slots();
            }
        }
        this.$el.data("data", this);
        this.$(".expand_format_editor").click(this.toggle_formats);

    },
    display_inline:function(){
        this.$el.html(this.inline_template({
            size: this.size,
            node: this.model
         }));
        this.load_slots();
        this.render_slots();
        this.$(".expand_format_editor").click(this.toggle_formats);
    },
    load_slots:function(){
        var self = this;
        this.format_views=[];
        var kind = window.contentkinds.findWhere({"kind" : this.model.get("kind")});
        kind.get("associated_presets").forEach(function(formatpreset){
            var preset = self.presets.get({id:formatpreset.id});
            if(!preset){
                preset = window.formatpresets.get({id: formatpreset.id});
            }

            var format_slot = new FormatSlot({
                preset:preset,
                model: self.model,
                file: preset.attached_format,// preset.get("attached_format"),
                containing_list_view: self.containing_list_view,
                acceptedFiles: preset.get("associated_mimetypes").join(","),
                container:self,
                list: self.$(".format_editor_list"),
                preview: self.preview
            });
            self.format_views.push(format_slot);
        });
    },
    render_slots:function(){
        this.format_views.forEach(function(view){
            view.render();
        });
        this.update_count();
        this.update_size();
    },
    enable_save:function(){
        this.$el.find(".save_initial_format").removeAttr("disabled");
    },
    update_size:function(){
        var size = 0;
        this.format_views.forEach(function(view){
            size +=  (view.file)? view.file.get("file_size") : 0;
        });
        this.$(".format_size_text").html(stringHelper.format_size(size));
    },
    assign_default_format:function(){
        this.initial = false;
        var preset = this.presets.get(this.$(".format_options_dropdown").val());
        this.default_file.set({
            contentnode: this.model.get("id"),
            preset : preset.get("id")
        });
        preset.attached_format = this.default_file;
        this.render();
        if(this.containing_list_view.check_completed()){
            this.containing_list_view.enable_submit();
        }else{
            this.containing_list_view.disable_submit();
        }
    },
    toggle_formats:function(){
        if(this.$el.find(".expand_format_editor").hasClass("glyphicon-triangle-bottom")){
            this.$el.find(".format_editor_list").slideUp();
            this.$el.find(".expand_format_editor").removeClass("glyphicon-triangle-bottom");
            this.$el.find(".expand_format_editor").addClass("glyphicon-triangle-top");
        }else{
            this.$el.find(".format_editor_list").slideDown();
            this.$el.find(".expand_format_editor").removeClass("glyphicon-triangle-top");
            this.$el.find(".expand_format_editor").addClass("glyphicon-triangle-bottom");
        }
    },
    update_count:function(){
        this.$(".format_counter").html(this.get_count(true));
        this.$el.find(".format_editor_remove").css("display", (this.get_count(true) ===1) ? "none" : "inline");

        if(this.get_count(false) ===1){
            this.$(".main_file_remove").css("display", "none");
        }
    },
    set_format:function(formatModel, preset){
        var assigned_preset = this.presets.get(preset);
        assigned_preset.attached_format = formatModel;
        if(formatModel){
            formatModel.set("preset", assigned_preset.id);
        }
    },
    update_name:function(event){
        this.model.set("title", event.target.value);
    },
    enable_submit:function(){
        this.containing_list_view.enable_submit();
    },
    disable_submit:function(){
        this.containing_list_view.disable_submit();
    },
    get_count:function(inlcudeSupplementary){
        var self = this;
        var count = 0;
        this.format_views.forEach(function(format){
            if(format.file){
                self.default_file = format.file;
                if(inlcudeSupplementary || !format.preset.get("supplementary")){
                    count++;
                }
            }
        });
        return count;
    },
    submit_file:function(){
        return this.set_model();
    },
    set_model:function(){
        var files = [];
        this.format_views.forEach(function(view){
            if(view.file){
                files.push(view.file);
            }
        });
        this.model.set("files", files);
        if(this.preview){
            this.preview.load_preview();
        }
        return this.model;
    },
    unset_model:function(){
        this.model.unset();
    },
    update_file:function(){
        if(this.update_models){
            this.set_model();
        }
    },
    clean_files:function(){
        this.files_to_delete.forEach(function(file){
            if(file){
              file.destroy();
            }
        });
    }
});

var FormatSlot = BaseViews.BaseListNodeItemView.extend({
    template: require("./hbtemplates/format_item.handlebars"),
    dropzone_template : require("./hbtemplates/format_dropzone_item.handlebars"),

    'id': function() {
        return "format_slot_item_" + this.model.get("id");
    },
    className:"row format_editor_item",
    initialize: function(options) {
        _.bindAll(this, 'remove_item','file_uploaded','file_added','file_removed','all_files_uploaded','file_failed');
        this.preset = options.preset;
        this.containing_list_view = options.containing_list_view;
        this.file = options.file;
        this.container = options.container;
        this.acceptedFiles = options.acceptedFiles;
        this.list = options.list;
        this.initial = true;
        this.preview= options.preview;
    },
    events: {
        'click .format_editor_remove ' : 'remove_item'
    },
    render: function() {
        this.$el.html(this.template({
            file:this.file,
            preset: this.preset,
            node: this.model,
            id:this.id() + "_" + this.preset.get("id")
        }));
        if(this.initial){
            this.list.append(this.el);
        }
        this.initial = false;
        this.$el.data("data", this);
        this.$el.attr("id", this.id() + "_" + this.preset.get("id"));
        if(this.model.get("kind") !== "topic" && (!this.containing_list_view.uploading || this.container.inline)){
            this.create_dropzone();
        }
    },
    create_dropzone:function(){
        var self = this;
        setTimeout(function(){
            var dz_selector="#" + self.$el.attr("id") + "_dropzone" + ((self.file)? "_swap" : "");
            var clickables = [dz_selector + " .dz_click"];
            if(self.file){
                clickables.push(dz_selector + " .format_editor_file_name");
            }
            if(self.$(dz_selector)){
                var dropzone = new Dropzone(self.$(dz_selector).get(0), {
                   clickable: clickables,
                   acceptedFiles: self.acceptedFiles,
                   url: window.Urls.file_upload(),
                   previewTemplate:self.dropzone_template(),
                   maxFiles: 1,
                   previewsContainer: dz_selector,
                   headers: {"X-CSRFToken": get_cookie("csrftoken")}
                });
                dropzone.on("success", self.file_uploaded);

                // Only enable the submit upload files button once all files have finished uploading.
                dropzone.on("queuecomplete", self.all_files_uploaded);
                dropzone.on("addedfile", self.file_added);
                dropzone.on("removedfile", self.file_removed);
               dropzone.on("error", self.file_failed);
            }
        }, 1);
    },
    file_uploaded:function(file){
        console.log("Successfully added file!", file);
        if(this.file){
            this.remove_item(null);
        }
        var self = this;
        this.file = new Models.FileModel({id: JSON.parse(file.xhr.response).object_id});
        this.file.fetch({
            success:function(file_model){
                self.file.set({
                    file_size : file.size,
                    contentnode: self.model.get("id"),
                    preset : self.preset.get("id")
                });
                self.preset.attached_format = self.file;
                self.container.set_model();
                self.render();
                self.container.update_size();
                self.container.update_count();
            },
            error:function(obj, error){
                console.log("Error uploading file", obj);
                console.log("Error message:", error);
                console.trace();
            }
        });
    },
    file_added: function(file) {
        if(this.file){
            this.$(".format_metadata").css("display", "none");
        }
        this.$(".add_format_button").css("display", "none");
        this.disable_submit();
    },
    file_removed: function(file) {
        this.$(".add_format_button").css("display", "inline");
        this.file.set("contentnode", null);
        this.preset.attached_format = null;
        this.render();
    },
    file_failed:function(file, error){
        alert(error);
        this.render();
    },
    remove_item:function(event){
        this.container.files_to_delete.add(this.file);
        this.file.set({contentnode: null});
        this.file = null;
        this.preset.attached_format = null;
        if(event){
            this.container.set_model();
            this.render();
            this.container.update_size();
            this.container.update_count();
        }
    },
    enable_submit:function(){
        this.container.enable_submit();
    },
    disable_submit:function(){
        this.container.disable_submit();
    },
    all_files_uploaded:function(){
        this.container.enable_submit();
    }

});

module.exports = {
    FileUploadView:FileUploadView,
    FileModalView:FileModalView,
    FormatItem:FormatItem
}