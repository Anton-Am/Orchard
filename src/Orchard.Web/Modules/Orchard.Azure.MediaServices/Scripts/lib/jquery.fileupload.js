/*
 * jQuery File Upload Plugin 5.40.1
 * https://github.com/blueimp/jQuery-File-Upload
 *
 * Copyright 2010, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/* jshint nomen:false */
/* global define, window, document, location, Blob, FormData */

(function (factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // Register as an anonymous AMD module:
        define([
            'jquery',
            'jquery.ui.widget'
        ], factory);
    } else {
        // Browser globals:
        factory(window.jQuery);
    }
}(function ($) {
    'use strict';

    // Detect file input support, based on
    // http://viljamis.com/blog/2012/file-upload-support-on-mobile/
    $.support.fileInput = !(new RegExp(
        // Handle devices which give false positives for the feature detection:
        '(Android (1\\.[0156]|2\\.[01]))' +
            '|(Windows Phone (OS 7|8\\.0))|(XBLWP)|(ZuneWP)|(WPDesktop)' +
            '|(w(eb)?OSBrowser)|(webOS)' +
            '|(Kindle/(1\\.0|2\\.[05]|3\\.0))'
    ).test(window.navigator.userAgent) ||
        // Feature detection for all other devices:
        $('<input type="file">').prop('disabled'));

    // The FileReader API is not actually used, but works as feature detection,
    // as some Safari versions (5?) support XHR file uploads via the FormData API,
    // but not non-multipart XHR file uploads.
    // window.XMLHttpRequestUpload is not available on IE10, so we check for
    // window.ProgressEvent instead to detect XHR2 file upload capability:
    $.support.xhrFileUpload = !!(window.ProgressEvent && window.FileReader);
    $.support.xhrFormDataFileUpload = !!window.FormData;

    // Detect support for Blob slicing (required for chunked uploads):
    $.support.blobSlice = window.Blob && (Blob.prototype.slice ||
        Blob.prototype.webkitSlice || Blob.prototype.mozSlice);

    // The fileupload widget listens for change events on file input fields defined
    // via fileInput setting and paste or drop events of the given dropZone.
    // In addition to the default jQuery Widget methods, the fileupload widget
    // exposes the "add" and "send" methods, to add or directly send files using
    // the fileupload API.
    // By default, files added via file input selection, paste, drag & drop or
    // "add" method are uploaded immediately, but it is possible to override
    // the "add" callback option to queue file uploads.
    $.widget('blueimp.fileupload', {

        options: {
            // The drop target element(s), by the default the complete document.
            // Set to null to disable drag & drop support:
            dropZone: $(document),
            // The paste target element(s), by the default the complete document.
            // Set to null to disable paste support:
            pasteZone: $(document),
            // The file input field(s), that are listened to for change events.
            // If undefined, it is set to the file input fields inside
            // of the widget element on plugin initialization.
            // Set to null to disable the change listener.
            fileInput: undefined,
            // By default, the file input field is replaced with a clone after
            // each input field change event. This is required for iframe transport
            // queues and allows change events to be fired for the same file
            // selection, but can be disabled by setting the following option to false:
            replaceFileInput: true,
            // The parameter name for the file form data (the request argument name).
            // If undefined or empty, the name property of the file input field is
            // used, or "files[]" if the file input name property is also empty,
            // can be a string or an array of strings:
            paramName: undefined,
            // By default, each file of a selection is uploaded using an individual
            // request for XHR type uploads. Set to false to upload file
            // selections in one request each:
            singleFileUploads: true,
            // To limit the number of files uploaded with one XHR request,
            // set the following option to an integer greater than 0:
            limitMultiFileUploads: undefined,
            // The following option limits the number of files uploaded with one
            // XHR request to keep the request size under or equal to the defined
            // limit in bytes:
            limitMultiFileUploadSize: undefined,
            // Multipart file uploads add a number of bytes to each uploaded file,
            // therefore the following option adds an overhead for each file used
            // in the limitMultiFileUploadSize configuration:
            limitMultiFileUploadSizeOverhead: 512,
            // Set the following option to true to issue all file upload requests
            // in a sequential order:
            sequentialUploads: false,
            // To limit the number of concurrent uploads,
            // set the following option to an integer greater than 0:
            limitConcurrentUploads: undefined,
            // Set the following option to true to force iframe transport uploads:
            forceIframeTransport: false,
            // Set the following option to the location of a redirect url on the
            // origin server, for cross-domain iframe transport uploads:
            redirect: undefined,
            // The parameter name for the redirect url, sent as part of the form
            // data and set to 'redirect' if this option is empty:
            redirectParamName: undefined,
            // Set the following option to the location of a postMessage window,
            // to enable postMessage transport uploads:
            postMessage: undefined,
            // By default, XHR file uploads are sent as multipart/form-data.
            // The iframe transport is always using multipart/form-data.
            // Set to false to enable non-multipart XHR uploads:
            multipart: true,
            // To upload large files in smaller chunks, set the following option
            // to a preferred maximum chunk size. If set to 0, null or undefined,
            // or the browser does not support the required Blob API, files will
            // be uploaded as a whole.
            maxChunkSize: undefined,
            // When a non-multipart upload or a chunked multipart upload has been
            // aborted, this option can be used to resume the upload by setting
            // it to the size of the already uploaded bytes. This option is most
            // useful when modifying the options object inside of the "add" or
            // "send" callbacks, as the options are cloned for each file upload.
            uploadedBytes: undefined,
            // By default, failed (abort or error) file uploads are removed from the
            // global progress calculation. Set the following option to false to
            // prevent recalculating the global progress data:
            recalculateProgress: true,
            // Interval in milliseconds to calculate and trigger progress events:
            progressInterval: 100,
            // Interval in milliseconds to calculate progress bitrate:
            bitrateInterval: 500,
            // By default, uploads are started automatically when adding files:
            autoUpload: true,

            // Error and info messages:
            messages: {
                uploadedBytes: 'Uploaded bytes exceed file size'
            },

            // Translation function, gets the message key to be translated
            // and an object with context specific data as arguments:
            i18n: function (message, context) {
                message = this.messages[message] || message.toString();
                if (context) {
                    $.each(context, function (key, value) {
                        message = message.replace('{' + key + '}', value);
                    });
                }
                return message;
            },

            // Additional form data to be sent along with the file uploads can be set
            // using this option, which accepts an array of objects with name and
            // value properties, a function returning such an array, a FormData
            // object (for XHR file uploads), or a simple object.
            // The form of the first fileInput is given as parameter to the function:
            formData: function (form) {
                return form.serializeArray();
            },

            // The add callback is invoked as soon as files are added to the fileupload
            // widget (via file input selection, drag & drop, paste or add API call).
            // If the singleFileUploads option is enabled, this callback will be
            // called once for each file in the selection for XHR file uploads, else
            // once for each file selection.
            //
            // The upload starts when the submit method is invoked on the data parameter.
            // The data object contains a files property holding the added files
            // and allows you to override plugin options as well as define ajax settings.
            //
            // Listeners for this callback can also be bound the following way:
            // .bind('fileuploadadd', func);
            //
            // data.submit() returns a Promise object and allows to attach additional
            // handlers using jQuery's Deferred callbacks:
            // data.submit().done(func).fail(func).always(func);
            add: function (e, data) {
                if (e.isDefaultPrevented()) {
                    return false;
                }
                if (data.autoUpload || (data.autoUpload !== false &&
                        $(this).fileupload('option', 'autoUpload'))) {
                    data.process().done(function () {
                        data.submit();
                    });
                }
            },

            // Other callbacks:

            // Callback for the submit event of each file upload:
            // submit: function (e, data) {}, // .bind('fileuploadsubmit', func);

            // Callback for the start of each file upload request:
            // send: function (e, data) {}, // .bind('fileuploadsend', func);

            // Callback for successful uploads:
            // done: function (e, data) {}, // .bind('fileuploaddone', func);

            // Callback for failed (abort or error) uploads:
            // fail: function (e, data) {}, // .bind('fileuploadfail', func);

            // Callback for completed (success, abort or error) requests:
            // always: function (e, data) {}, // .bind('fileuploadalways', func);

            // Callback for upload progress events:
            // progress: function (e, data) {}, // .bind('fileuploadprogress', func);

            // Callback for global upload progress events:
            // progressall: function (e, data) {}, // .bind('fileuploadprogressall', func);

            // Callback for uploads start, equivalent to the global ajaxStart event:
            // start: function (e) {}, // .bind('fileuploadstart', func);

            // Callback for uploads stop, equivalent to the global ajaxStop event:
            // stop: function (e) {}, // .bind('fileuploadstop', func);

            // Callback for change events of the fileInput(s):
            // change: function (e, data) {}, // .bind('fileuploadchange', func);

            // Callback for paste events to the pasteZone(s):
            // paste: function (e, data) {}, // .bind('fileuploadpaste', func);

            // Callback for drop events of the dropZone(s):
            // drop: function (e, data) {}, // .bind('fileuploaddrop', func);

            // Callback for dragover events of the dropZone(s):
            // dragover: function (e) {}, // .bind('fileuploaddragover', func);

            // Callback for the start of each chunk upload request:
            // chunksend: function (e, data) {}, // .bind('fileuploadchunksend', func);

            // Callback for successful chunk uploads:
            // chunkdone: function (e, data) {}, // .bind('fileuploadchunkdone', func);

            // Callback for failed (abort or error) chunk uploads:
            // chunkfail: function (e, data) {}, // .bind('fileuploadchunkfail', func);

            // Callback for completed (success, abort or error) chunk upload requests:
            // chunkalways: function (e, data) {}, // .bind('fileuploadchunkalways', func);

            // The plugin options are used as settings object for the ajax calls.
            // The following are jQuery ajax settings required for the file uploads:
            processData: false,
            contentType: false,
            cache: false
        },

        // A list of options that require reinitializing event listeners and/or
        // special initialization code:
        _specialOptions: [
            'fileInput',
            'dropZone',
            'pasteZone',
            'multipart',
            'forceIframeTransport'
        ],

        _blobSlice: $.support.blobSlice && function () {
            var slice = this.slice || this.webkitSlice || this.mozSlice;
            return slice.apply(this, arguments);
        },

        _BitrateTimer: function () {
            this.timestamp = ((Date.now) ? Date.now() : (new Date()).getTime());
            this.loaded = 0;
            this.bitrate = 0;
            this.getBitrate = function (now, loaded, interval) {
                var timeDiff = now - this.timestamp;
                if (!this.bitrate || !interval || timeDiff > interval) {
                    this.bitrate = (loaded - this.loaded) * (1000 / timeDiff) * 8;
                    this.loaded = loaded;
                    this.timestamp = now;
                }
                return this.bitrate;
            };
        },

        _isXHRUpload: function (options) {
            return !options.forceIframeTransport &&
                ((!options.multipart && $.support.xhrFileUpload) ||
                $.support.xhrFormDataFileUpload);
        },

        _getFormData: function (options) {
            var formData;
            if ($.type(options.formData) === 'function') {
                return options.formData(options.form);
            }
            if ($.isArray(options.formData)) {
                return options.formData;
            }
            if ($.type(options.formData) === 'object') {
                formData = [];
                $.each(options.formData, function (name, value) {
                    formData.push({name: name, value: value});
                });
                return formData;
            }
            return [];
        },

        _getTotal: function (files) {
            var total = 0;
            $.each(files, function (index, file) {
                total += file.size || 1;
            });
            return total;
        },

        _initProgressObject: function (obj) {
            var progress = {
                loaded: 0,
                total: 0,
                bitrate: 0
            };
            if (obj._progress) {
                $.extend(obj._progress, progress);
            } else {
                obj._progress = progress;
            }
        },

        _initResponseObject: function (obj) {
            var prop;
            if (obj._response) {
                for (prop in obj._response) {
                    if (obj._response.hasOwnProperty(prop)) {
                        delete obj._response[prop];
                    }
                }
            } else {
                obj._response = {};
            }
        },

        _onProgress: function (e, data) {
            if (e.lengthComputable) {
                var now = ((Date.now) ? Date.now() : (new Date()).getTime()),
                    loaded;
                if (data._time && data.progressInterval &&
                        (now - data._time < data.progressInterval) &&
                        e.loaded !== e.total) {
                    return;
                }
                data._time = now;
                loaded = Math.floor(
                    e.loaded / e.total * (data.chunkSize || data._progress.total)
                ) + (data.uploadedBytes || 0);
                // Add the difference from the previously loaded state
                // to the global loaded counter:
                this._progress.loaded += (loaded - data._progress.loaded);
                this._progress.bitrate = this._bitrateTimer.getBitrate(
                    now,
                    this._progress.loaded,
                    data.bitrateInterval
                );
                data._progress.loaded = data.loaded = loaded;
                data._progress.bitrate = data.bitrate = data._bitrateTimer.getBitrate(
                    now,
                    loaded,
                    data.bitrateInterval
                );
                // Trigger a custom progress event with a total data property set
                // to the file size(s) of the current upload and a loaded data
                // property calculated accordingly:
                this._trigger(
                    'progress',
                    $.Event('progress', {delegatedEvent: e}),
                    data
                );
                // Trigger a global progress event for all current file uploads,
                // including ajax calls queued for sequential file uploads:
                this._trigger(
                    'progressall',
                    $.Event('progressall', {delegatedEvent: e}),
                    this._progress
                );
            }
        },

        _initProgressListener: function (options) {
            var that = this,
                xhr = options.xhr ? options.xhr() : $.ajaxSettings.xhr();
            // Accesss to the native XHR object is required to add event listeners
            // for the upload progress event:
            if (xhr.upload) {
                $(xhr.upload).bind('progress', function (e) {
                    var oe = e.originalEvent;
                    // Make sure the progress event properties get copied over:
                    e.lengthComputable = oe.lengthComputable;
                    e.loaded = oe.loaded;
                    e.total = oe.total;
                    that._onProgress(e, options);
                });
                options.xhr = function () {
                    return xhr;
                };
            }
        },

        _isInstanceOf: function (type, obj) {
            // Cross-frame instanceof check
            return Object.prototype.toString.call(obj) === '[object ' + type + ']';
        },

        _initXHRData: function (options) {
            var that = this,
                formData,
                file = options.files[0],
                // Ignore non-multipart setting if not supported:
                multipart = options.multipart || !$.support.xhrFileUpload,
                paramName = $.type(options.paramName) === 'array' ?
                    options.paramName[0] : options.paramName;
            options.headers = $.extend({}, options.headers);
            if (options.contentRange) {
                options.headers['Content-Range'] = options.contentRange;
            }
            if (!multipart || options.blob || !this._isInstanceOf('File', file)) {
                options.headers['Content-Disposition'] = 'attachment; filename="' +
                    encodeURI(file.name) + '"';
            }
            if (!multipart) {
                options.contentType = file.type || 'application/octet-stream';
                options.data = options.blob || file;
            } else if ($.support.xhrFormDataFileUpload) {
                if (options.postMessage) {
                    // window.postMessage does not allow sending FormData
                    // objects, so we just add the File/Blob objects to
                    // the formData array and let the postMessage window
                    // create the FormData object out of this array:
                    formData = this._getFormData(options);
                    if (options.blob) {
                        formData.push({
                            name: paramName,
                            value: options.blob
                        });
                    } else {
                        $.each(options.files, function (index, file) {
                            formData.push({
                                name: ($.type(options.paramName) === 'array' &&
                                    options.paramName[index]) || paramName,
                                value: file
                            });
                        });
                    }
                } else {
                    if (that._isInstanceOf('FormData', options.formData)) {
                        formData = options.formData;
                    } else {
                        formData = new FormData();
                        $.each(this._getFormData(options), function (index, field) {
                            formData.append(field.name, field.value);
                        });
                    }
                    if (options.blob) {
                        formData.append(paramName, options.blob, file.name);
                    } else {
                        $.each(options.files, function (index, file) {
                            // This check allows the tests to run with
                            // dummy objects:
                            if (that._isInstanceOf('File', file) ||
                                    that._isInstanceOf('Blob', file)) {
                                formData.append(
                                    ($.type(options.paramName) === 'array' &&
                                        options.paramName[index]) || paramName,
                                    file,
                                    file.uploadName || file.name
                                );
                            }
                        });
                    }
                }
                options.data = formData;
            }
            // Blob reference is not needed anymore, free memory:
            options.blob = null;
        },

        _initIframeSettings: function (options) {
            var targetHost = $('<a></a>').prop('href', options.url).prop('host');
            // Setting the dataType to iframe enables the iframe transport:
            options.dataType = 'iframe ' + (options.dataType || '');
            // The iframe transport accepts a serialized array as form data:
            options.formData = this._getFormData(options);
            // Add redirect url to form data on cross-domain uploads:
            if (options.redirect && targetHost && targetHost !== location.host) {
                options.formData.push({
                    name: options.redirectParamName || 'redirect',
                    value: options.redirect
                });
            }
        },

        _initDataSettings: function (options) {
            if (this._isXHRUpload(options)) {
                if (!this._chunkedUpload(options, true)) {
                    if (!options.data) {
                        this._initXHRData(options);
                    }
                    this._initProgressListener(options);
                }
                if (options.postMessage) {
                    // Setting the dataType to postmessage enables the
                    // postMessage transport:
                    options.dataType = 'postmessage ' + (options.dataType || '');
                }
            } else {
                this._initIframeSettings(options);
            }
        },

        _getParamName: function (options) {
            var fileInput = $(options.fileInput),
                paramName = options.paramName;
            if (!paramName) {
                paramName = [];
                fileInput.each(function () {
                    var input = $(this),
                        name = input.prop('name') || 'files[]',
                        i = (input.prop('files') || [1]).length;
                    while (i) {
                        paramName.push(name);
                        i -= 1;
                    }
                });
                if (!paramName.length) {
                    paramName = [fileInput.prop('name') || 'files[]'];
                }
            } else if (!$.isArray(paramName)) {
                paramName = [paramName];
            }
            return paramName;
        },

        _initFormSettings: function (options) {
            // Retrieve missing options from the input field and the
            // associated form, if available:
            if (!options.form || !options.form.length) {
                options.form = $(options.fileInput.prop('form'));
                // If the given file input doesn't have an associated form,
                // use the default widget file input's form:
                if (!options.form.length) {
                    options.form = $(this.options.fileInput.prop('form'));
                }
            }
            options.paramName = this._getParamName(options);
            if (!options.url) {
                options.url = options.form.prop('action') || location.href;
            }
            // The HTTP request method must be "POST" or "PUT":
            options.type = (options.type ||
                ($.type(options.form.prop('method')) === 'string' &&
                    options.form.prop('method')) || ''
                ).toUpperCase();
            if (options.type !== 'POST' && options.type !== 'PUT' &&
                    options.type !== 'PATCH') {
                options.type = 'POST';
            }
            if (!options.formAcceptCharset) {
                options.formAcceptCharset = options.form.attr('accept-charset');
            }
        },

        _getAJAXSettings: function (data) {
            var options = $.extend({}, this.options, data);
            this._initFormSettings(options);
            this._initDataSettings(options);
            return options;
        },

        // jQuery 1.6 doesn't provide .state(),
        // while jQuery 1.8+ removed .isRejected() and .isResolved():
        _getDeferredState: function (deferred) {
            if (deferred.state) {
                return deferred.state();
            }
            if (deferred.isResolved()) {
                return 'resolved';
            }
            if (deferred.isRejected()) {
                return 'rejected';
            }
            return 'pending';
        },

        // Maps jqXHR callbacks to the equivalent
        // methods of the given Promise object:
        _enhancePromise: function (promise) {
            promise.success = promise.done;
            promise.error = promise.fail;
            promise.complete = promise.always;
            return promise;
        },

        // Creates and returns a Promise object enhanced with
        // the jqXHR methods abort, success, error and complete:
        _getXHRPromise: function (resolveOrReject, context, args) {
            var dfd = $.Deferred(),
                promise = dfd.promise();
            context = context || this.options.context || promise;
            if (resolveOrReject === true) {
                dfd.resolveWith(context, args);
            } else if (resolveOrReject === false) {
                dfd.rejectWith(context, args);
            }
            promise.abort = dfd.promise;
            return this._enhancePromise(promise);
        },

        // Adds convenience methods to the data callback argument:
        _addConvenienceMethods: function (e, data) {
            var that = this,
                getPromise = function (args) {
                    return $.Deferred().resolveWith(that, args).promise();
                };
            data.process = function (resolveFunc, rejectFunc) {
                if (resolveFunc || rejectFunc) {
                    data._processQueue = this._processQueue =
                        (this._processQueue || getPromise([this])).pipe(
                            function () {
                                if (data.errorThrown) {
                                    return $.Deferred()
                                        .rejectWith(that, [data]).promise();
                                }
                                return getPromise(arguments);
                            }
                        ).pipe(resolveFunc, rejectFunc);
                }
                return this._processQueue || getPromise([this]);
            };
            data.submit = function () {
                if (this.state() !== 'pending') {
                    data.jqXHR = this.jqXHR =
                        (that._trigger(
                            'submit',
                            $.Event('submit', {delegatedEvent: e}),
                            this
                        ) !== false) && that._onSend(e, this);
                }
                return this.jqXHR || that._getXHRPromise();
            };
            data.abort = function () {
                if (this.jqXHR) {
                    return this.jqXHR.abort();
                }
                this.errorThrown = 'abort';
                that._trigger('fail', null, this);
                return that._getXHRPromise(false);
            };
            data.state = function () {
                if (this.jqXHR) {
                    return that._getDeferredState(this.jqXHR);
                }
                if (this._processQueue) {
                    return that._getDeferredState(this._processQueue);
                }
            };
            data.processing = function () {
                return !this.jqXHR && this._processQueue && that
                    ._getDeferredState(this._processQueue) === 'pending';
            };
            data.progress = function () {
                return this._progress;
            };
            data.response = function () {
                return this._response;
            };
        },

        // Parses the Range header from the server response
        // and returns the uploaded bytes:
        _getUploadedBytes: function (jqXHR) {
            var range = jqXHR.getResponseHeader('Range'),
                parts = range && range.split('-'),
                upperBytesPos = parts && parts.length > 1 &&
                    parseInt(parts[1], 10);
            return upperBytesPos && upperBytesPos + 1;
        },

        // Uploads a file in multiple, sequential requests
        // by splitting the file up in multiple blob chunks.
        // If the second parameter is true, only tests if the file
        // should be uploaded in chunks, but does not invoke any
        // upload requests:
        _chunkedUpload: function (options, testOnly) {
            options.uploadedBytes = options.uploadedBytes || 0;
            var that = this,
                file = options.files[0],
                fs = file.size,
                ub = options.uploadedBytes,
                mcs = options.maxChunkSize || fs,
                slice = this._blobSlice,
                dfd = $.Deferred(),
                promise = dfd.promise(),
                jqXHR,
                upload;
            if (!(this._isXHRUpload(options) && slice && (ub || mcs < fs)) ||
                    options.data) {
                return false;
            }
            if (testOnly) {
                return true;
            }
            if (ub >= fs) {
                file.error = options.i18n('uploadedBytes');
                return this._getXHRPromise(
                    false,
                    options.context,
                    [null, 'error', file.error]
                );
            }
            // The chunk upload method:
            upload = function () {
                // Clone the options object for each chunk upload:
                var o = $.extend({}, options),
                    currentLoaded = o._progress.loaded;
                o.blob = slice.call(
                    file,
                    ub,
                    ub + mcs,
                    file.type
                );
                // Store the current chunk size, as the blob itself
                // will be dereferenced after data processing:
                o.chunkSize = o.blob.size;
                // Expose the chunk bytes position range:
                o.contentRange = 'bytes ' + ub + '-' +
                    (ub + o.chunkSize - 1) + '/' + fs;
                // Process the upload data (the blob and potential form data):
                that._initXHRData(o);
                // Add progress listeners for this chunk upload:
                that._initProgressListener(o);
                jqXHR = ((that._trigger('chunksend', null, o) !== false && $.ajax(o)) ||
                        that._getXHRPromise(false, o.context))
                    .done(function (result, textStatus, jqXHR) {
                        ub = that._getUploadedBytes(jqXHR) ||
                            (ub + o.chunkSize);
                        // Create a progress event if no final progress event
                        // with loaded equaling total has been triggered
                        // for this chunk:
                        if (currentLoaded + o.chunkSize - o._progress.loaded) {
                            that._onProgress($.Event('progress', {
                                lengthComputable: true,
                                loaded: ub - o.uploadedBytes,
                                total: ub - o.uploadedBytes
                            }), o);
                        }
                        options.uploadedBytes = o.uploadedBytes = ub;
                        o.result = result;
                        o.textStatus = textStatus;
                        o.jqXHR = jqXHR;
                        that._trigger('chunkdone', null, o);
                        that._trigger('chunkalways', null, o);
                        if (ub < fs) {
                            // File upload not yet complete,
                            // continue with the next chunk:
                            upload();
                        } else {
                            dfd.resolveWith(
                                o.context,
                                [result, textStatus, jqXHR]
                            );
                        }
                    })
                    .fail(function (jqXHR, textStatus, errorThrown) {
                        o.jqXHR = jqXHR;
                        o.textStatus = textStatus;
                        o.errorThrown = errorThrown;
                        that._trigger('chunkfail', null, o);
                        that._trigger('chunkalways', null, o);
                        dfd.rejectWith(
                            o.context,
                            [jqXHR, textStatus, errorThrown]
                        );
                    });
            };
            this._enhancePromise(promise);
            promise.abort = function () {
                return jqXHR.abort();
            };
            upload();
            return promise;
        },

        _beforeSend: function (e, data) {
            if (this._active === 0) {
                // the start callback is triggered when an upload starts
                // and no other uploads are currently running,
                // equivalent to the global ajaxStart event:
                this._trigger('start');
                // Set timer for global bitrate progress calculation:
                this._bitrateTimer = new this._BitrateTimer();
                // Reset the global progress values:
                this._progress.loaded = this._progress.total = 0;
                this._progress.bitrate = 0;
            }
            // Make sure the container objects for the .response() and
            // .progress() methods on the data object are available
            // and reset to their initial state:
            this._initResponseObject(data);
            this._initProgressObject(data);
            data._progress.loaded = data.loaded = data.uploadedBytes || 0;
            data._progress.total = data.total = this._getTotal(data.files) || 1;
            data._progress.bitrate = data.bitrate = 0;
            this._active += 1;
            // Initialize the global progress values:
            this._progress.loaded += data.loaded;
            this._progress.total += data.total;
        },

        _onDone: function (result, textStatus, jqXHR, options) {
            var total = options._progress.total,
                response = options._response;
            if (options._progress.loaded < total) {
                // Create a progress event if no final progress event
                // with loaded equaling total has been triggered:
                this._onProgress($.Event('progress', {
                    lengthComputable: true,
                    loaded: total,
                    total: total
                }), options);
            }
            response.result = options.result = result;
            response.textStatus = options.textStatus = textStatus;
            response.jqXHR = options.jqXHR = jqXHR;
            this._trigger('done', null, options);
        },

        _onFail: function (jqXHR, textStatus, errorThrown, options) {
            var response = options._response;
            if (options.recalculateProgress) {
                // Remove the failed (error or abort) file upload from
                // the global progress calculation:
                this._progress.loaded -= options._progress.loaded;
                this._progress.total -= options._progress.total;
            }
            response.jqXHR = options.jqXHR = jqXHR;
            response.textStatus = options.textStatus = textStatus;
            response.errorThrown = options.errorThrown = errorThrown;
            this._trigger('fail', null, options);
        },

        _onAlways: function (jqXHRorResult, textStatus, jqXHRorError, options) {
            // jqXHRorResult, textStatus and jqXHRorError are added to the
            // options object via done and fail callbacks
            this._trigger('always', null, options);
        },

        _onSend: function (e, data) {
            if (!data.submit) {
                this._addConvenienceMethods(e, data);
            }
            var that = this,
                jqXHR,
                aborted,
                slot,
                pipe,
                options = that._getAJAXSettings(data),
                send = function () {
                    that._sending += 1;
                    // Set timer for bitrate progress calculation:
                    options._bitrateTimer = new that._BitrateTimer();
                    jqXHR = jqXHR || (
                        ((aborted || that._trigger(
                            'send',
                            $.Event('send', {delegatedEvent: e}),
                            options
                        ) === false) &&
                        that._getXHRPromise(false, options.context, aborted)) ||
                        that._chunkedUpload(options) || $.ajax(options)
                    ).done(function (result, textStatus, jqXHR) {
                        that._onDone(result, textStatus, jqXHR, options);
                    }).fail(function (jqXHR, textStatus, errorThrown) {
                        that._onFail(jqXHR, textStatus, errorThrown, options);
                    }).always(function (jqXHRorResult, textStatus, jqXHRorError) {
                        that._onAlways(
                            jqXHRorResult,
                            textStatus,
                            jqXHRorError,
                            options
                        );
                        that._sending -= 1;
                        that._active -= 1;
                        if (options.limitConcurrentUploads &&
                                options.limitConcurrentUploads > that._sending) {
                            // Start the next queued upload,
                            // that has not been aborted:
                            var nextSlot = that._slots.shift();
                            while (nextSlot) {
                                if (that._getDeferredState(nextSlot) === 'pending') {
                                    nextSlot.resolve();
                                    break;
                                }
                                nextSlot = that._slots.shift();
                            }
                        }
                        if (that._active === 0) {
                            // The stop callback is triggered when all uploads have
                            // been completed, equivalent to the global ajaxStop event:
                            that._trigger('stop');
                        }
                    });
                    return jqXHR;
                };
            this._beforeSend(e, options);
            if (this.options.sequentialUploads ||
                    (this.options.limitConcurrentUploads &&
                    this.options.limitConcurrentUploads <= this._sending)) {
                if (this.options.limitConcurrentUploads > 1) {
                    slot = $.Deferred();
                    this._slots.push(slot);
                    pipe = slot.pipe(send);
                } else {
                    this._sequence = this._sequence.pipe(send, send);
                    pipe = this._sequence;
                }
                // Return the piped Promise object, enhanced with an abort method,
                // which is delegated to the jqXHR object of the current upload,
                // and jqXHR callbacks mapped to the equivalent Promise methods:
                pipe.abort = function () {
                    aborted = [undefined, 'abort', 'abort'];
                    if (!jqXHR) {
                        if (slot) {
                            slot.rejectWith(options.context, aborted);
                        }
                        return send();
                    }
                    return jqXHR.abort();
                };
                return this._enhancePromise(pipe);
            }
            return send();
        },

        _onAdd: function (e, data) {
            var that = this,
                result = true,
                options = $.extend({}, this.options, data),
                files = data.files,
                filesLength = files.length,
                limit = options.limitMultiFileUploads,
                limitSize = options.limitMultiFileUploadSize,
                overhead = options.limitMultiFileUploadSizeOverhead,
                batchSize = 0,
                paramName = this._getParamName(options),
                paramNameSet,
                paramNameSlice,
                fileSet,
                i,
                j = 0;
            if (limitSize && (!filesLength || files[0].size === undefined)) {
                limitSize = undefined;
            }
            if (!(options.singleFileUploads || limit || limitSize) ||
                    !this._isXHRUpload(options)) {
                fileSet = [files];
                paramNameSet = [paramName];
            } else if (!(options.singleFileUploads || limitSize) && limit) {
                fileSet = [];
                paramNameSet = [];
                for (i = 0; i < filesLength; i += limit) {
                    fileSet.push(files.slice(i, i + limit));
                    paramNameSlice = paramName.slice(i, i + limit);
                    if (!paramNameSlice.length) {
                        paramNameSlice = paramName;
                    }
                    paramNameSet.push(paramNameSlice);
                }
            } else if (!options.singleFileUploads && limitSize) {
                fileSet = [];
                paramNameSet = [];
                for (i = 0; i < filesLength; i = i + 1) {
                    batchSize += files[i].size + overhead;
                    if (i + 1 === filesLength ||
                            ((batchSize + files[i + 1].size + overhead) > limitSize) ||
                            (limit && i + 1 - j >= limit)) {
                        fileSet.push(files.slice(j, i + 1));
                        paramNameSlice = paramName.slice(j, i + 1);
                        if (!paramNameSlice.length) {
                            paramNameSlice = paramName;
                        }
                        paramNameSet.push(paramNameSlice);
                        j = i + 1;
                        batchSize = 0;
                    }
                }
            } else {
                paramNameSet = paramName;
            }
            data.originalFiles = files;
            $.each(fileSet || files, function (index, element) {
                var newData = $.extend({}, data);
                newData.files = fileSet ? element : [element];
                newData.paramName = paramNameSet[index];
                that._initResponseObject(newData);
                that._initProgressObject(newData);
                that._addConvenienceMethods(e, newData);
                result = that._trigger(
                    'add',
                    $.Event('add', {delegatedEvent: e}),
                    newData
                );
                return result;
            });
            return result;
        },

        _replaceFileInput: function (input) {
            var inputClone = input.clone(true);
            $('<form></form>').append(inputClone)[0].reset();
            // Detaching allows to insert the fileInput on another form
            // without loosing the file input value:
            input.after(inputClone).detach();
            // Avoid memory leaks with the detached file input:
            $.cleanData(input.unbind('remove'));
            // Replace the original file input element in the fileInput
            // elements set with the clone, which has been copied including
            // event handlers:
            this.options.fileInput = this.options.fileInput.map(function (i, el) {
                if (el === input[0]) {
                    return inputClone[0];
                }
                return el;
            });
            // If the widget has been initialized on the file input itself,
            // override this.element with the file input clone:
            if (input[0] === this.element[0]) {
                this.element = inputClone;
            }
        },

        _handleFileTreeEntry: function (entry, path) {
            var that = this,
                dfd = $.Deferred(),
                errorHandler = function (e) {
                    if (e && !e.entry) {
                        e.entry = entry;
                    }
                    // Since $.when returns immediately if one
                    // Deferred is rejected, we use resolve instead.
                    // This allows valid files and invalid items
                    // to be returned together in one set:
                    dfd.resolve([e]);
                },
                dirReader;
            path = path || '';
            if (entry.isFile) {
                if (entry._file) {
                    // Workaround for Chrome bug #149735
                    entry._file.relativePath = path;
                    dfd.resolve(entry._file);
                } else {
                    entry.file(function (file) {
                        file.relativePath = path;
                        dfd.resolve(file);
                    }, errorHandler);
                }
            } else if (entry.isDirectory) {
                dirReader = entry.createReader();
                dirReader.readEntries(function (entries) {
                    that._handleFileTreeEntries(
                        entries,
                        path + entry.name + '/'
                    ).done(function (files) {
                        dfd.resolve(files);
                    }).fail(errorHandler);
                }, errorHandler);
            } else {
                // Return an empy list for file system items
                // other than files or directories:
                dfd.resolve([]);
            }
            return dfd.promise();
        },

        _handleFileTreeEntries: function (entries, path) {
            var that = this;
            return $.when.apply(
                $,
                $.map(entries, function (entry) {
                    return that._handleFileTreeEntry(entry, path);
                })
            ).pipe(function () {
                return Array.prototype.concat.apply(
                    [],
                    arguments
                );
            });
        },

        _getDroppedFiles: function (dataTransfer) {
            dataTransfer = dataTransfer || {};
            var items = dataTransfer.items;
            if (items && items.length && (items[0].webkitGetAsEntry ||
                    items[0].getAsEntry)) {
                return this._handleFileTreeEntries(
                    $.map(items, function (item) {
                        var entry;
                        if (item.webkitGetAsEntry) {
                            entry = item.webkitGetAsEntry();
                            if (entry) {
                                // Workaround for Chrome bug #149735:
                                entry._file = item.getAsFile();
                            }
                            return entry;
                        }
                        return item.getAsEntry();
                    })
                );
            }
            return $.Deferred().resolve(
                $.makeArray(dataTransfer.files)
            ).promise();
        },

        _getSingleFileInputFiles: function (fileInput) {
            fileInput = $(fileInput);
            var entries = fileInput.prop('webkitEntries') ||
                    fileInput.prop('entries'),
                files,
                value;
            if (entries && entries.length) {
                return this._handleFileTreeEntries(entries);
            }
            files = $.makeArray(fileInput.prop('files'));
            if (!files.length) {
                value = fileInput.prop('value');
                if (!value) {
                    return $.Deferred().resolve([]).promise();
                }
                // If the files property is not available, the browser does not
                // support the File API and we add a pseudo File object with
                // the input value as name with path information removed:
                files = [{name: value.replace(/^.*\\/, '')}];
            } else if (files[0].name === undefined && files[0].fileName) {
                // File normalization for Safari 4 and Firefox 3:
                $.each(files, function (index, file) {
                    file.name = file.fileName;
                    file.size = file.fileSize;
                });
            }
            return $.Deferred().resolve(files).promise();
        },

        _getFileInputFiles: function (fileInput) {
            if (!(fileInput instanceof $) || fileInput.length === 1) {
                return this._getSingleFileInputFiles(fileInput);
            }
            return $.when.apply(
                $,
                $.map(fileInput, this._getSingleFileInputFiles)
            ).pipe(function () {
                return Array.prototype.concat.apply(
                    [],
                    arguments
                );
            });
        },

        _onChange: function (e) {
            var that = this,
                data = {
                    fileInput: $(e.target),
                    form: $(e.target.form)
                };
            this._getFileInputFiles(data.fileInput).always(function (files) {
                data.files = files;
                if (that.options.replaceFileInput) {
                    that._replaceFileInput(data.fileInput);
                }
                if (that._trigger(
                        'change',
                        $.Event('change', {delegatedEvent: e}),
                        data
                    ) !== false) {
                    that._onAdd(e, data);
                }
            });
        },

        _onPaste: function (e) {
            var items = e.originalEvent && e.originalEvent.clipboardData &&
                    e.originalEvent.clipboardData.items,
                data = {files: []};
            if (items && items.length) {
                $.each(items, function (index, item) {
                    var file = item.getAsFile && item.getAsFile();
                    if (file) {
                        data.files.push(file);
                    }
                });
                if (this._trigger(
                        'paste',
                        $.Event('paste', {delegatedEvent: e}),
                        data
                    ) !== false) {
                    this._onAdd(e, data);
                }
            }
        },

        _onDrop: function (e) {
            e.dataTransfer = e.originalEvent && e.originalEvent.dataTransfer;
            var that = this,
                dataTransfer = e.dataTransfer,
                data = {};
            if (dataTransfer && dataTransfer.files && dataTransfer.files.length) {
                e.preventDefault();
                this._getDroppedFiles(dataTransfer).always(function (files) {
                    data.files = files;
                    if (that._trigger(
                            'drop',
                            $.Event('drop', {delegatedEvent: e}),
                            data
                        ) !== false) {
                        that._onAdd(e, data);
                    }
                });
            }
        },

        _onDragOver: function (e) {
            e.dataTransfer = e.originalEvent && e.originalEvent.dataTransfer;
            var dataTransfer = e.dataTransfer;
            if (dataTransfer && $.inArray('Files', dataTransfer.types) !== -1 &&
                    this._trigger(
                        'dragover',
                        $.Event('dragover', {delegatedEvent: e})
                    ) !== false) {
                e.preventDefault();
                dataTransfer.dropEffect = 'copy';
            }
        },

        _initEventHandlers: function () {
            if (this._isXHRUpload(this.options)) {
                this._on(this.options.dropZone, {
                    dragover: this._onDragOver,
                    drop: this._onDrop
                });
                this._on(this.options.pasteZone, {
                    paste: this._onPaste
                });
            }
            if ($.support.fileInput) {
                this._on(this.options.fileInput, {
                    change: this._onChange
                });
            }
        },

        _destroyEventHandlers: function () {
            this._off(this.options.dropZone, 'dragover drop');
            this._off(this.options.pasteZone, 'paste');
            this._off(this.options.fileInput, 'change');
        },

        _setOption: function (key, value) {
            var reinit = $.inArray(key, this._specialOptions) !== -1;
            if (reinit) {
                this._destroyEventHandlers();
            }
            this._super(key, value);
            if (reinit) {
                this._initSpecialOptions();
                this._initEventHandlers();
            }
        },

        _initSpecialOptions: function () {
            var options = this.options;
            if (options.fileInput === undefined) {
                options.fileInput = this.element.is('input[type="file"]') ?
                        this.element : this.element.find('input[type="file"]');
            } else if (!(options.fileInput instanceof $)) {
                options.fileInput = $(options.fileInput);
            }
            if (!(options.dropZone instanceof $)) {
                options.dropZone = $(options.dropZone);
            }
            if (!(options.pasteZone instanceof $)) {
                options.pasteZone = $(options.pasteZone);
            }
        },

        _getRegExp: function (str) {
            var parts = str.split('/'),
                modifiers = parts.pop();
            parts.shift();
            return new RegExp(parts.join('/'), modifiers);
        },

        _isRegExpOption: function (key, value) {
            return key !== 'url' && $.type(value) === 'string' &&
                /^\/.*\/[igm]{0,3}$/.test(value);
        },

        _initDataAttributes: function () {
            var that = this,
                options = this.options,
                clone = $(this.element[0].cloneNode(false));
            // Initialize options set via HTML5 data-attributes:
            $.each(
                clone.data(),
                function (key, value) {
                    var dataAttributeName = 'data-' +
                        // Convert camelCase to hyphen-ated key:
                        key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
                    if (clone.attr(dataAttributeName)) {
                        if (that._isRegExpOption(key, value)) {
                            value = that._getRegExp(value);
                        }
                        options[key] = value;
                    }
                }
            );
        },

        _create: function () {
            this._initDataAttributes();
            this._initSpecialOptions();
            this._slots = [];
            this._sequence = this._getXHRPromise(true);
            this._sending = this._active = 0;
            this._initProgressObject(this);
            this._initEventHandlers();
        },

        // This method is exposed to the widget API and allows to query
        // the number of active uploads:
        active: function () {
            return this._active;
        },

        // This method is exposed to the widget API and allows to query
        // the widget upload progress.
        // It returns an object with loaded, total and bitrate properties
        // for the running uploads:
        progress: function () {
            return this._progress;
        },

        // This method is exposed to the widget API and allows adding files
        // using the fileupload API. The data parameter accepts an object which
        // must have a files property and can contain additional options:
        // .fileupload('add', {files: filesList});
        add: function (data) {
            var that = this;
            if (!data || this.options.disabled) {
                return;
            }
            if (data.fileInput && !data.files) {
                this._getFileInputFiles(data.fileInput).always(function (files) {
                    data.files = files;
                    that._onAdd(null, data);
                });
            } else {
                data.files = $.makeArray(data.files);
                this._onAdd(null, data);
            }
        },

        // This method is exposed to the widget API and allows sending files
        // using the fileupload API. The data parameter accepts an object which
        // must have a files or fileInput property and can contain additional options:
        // .fileupload('send', {files: filesList});
        // The method returns a Promise object for the file upload call.
        send: function (data) {
            if (data && !this.options.disabled) {
                if (data.fileInput && !data.files) {
                    var that = this,
                        dfd = $.Deferred(),
                        promise = dfd.promise(),
                        jqXHR,
                        aborted;
                    promise.abort = function () {
                        aborted = true;
                        if (jqXHR) {
                            return jqXHR.abort();
                        }
                        dfd.reject(null, 'abort', 'abort');
                        return promise;
                    };
                    this._getFileInputFiles(data.fileInput).always(
                        function (files) {
                            if (aborted) {
                                return;
                            }
                            if (!files.length) {
                                dfd.reject();
                                return;
                            }
                            data.files = files;
                            jqXHR = that._onSend(null, data).then(
                                function (result, textStatus, jqXHR) {
                                    dfd.resolve(result, textStatus, jqXHR);
                                },
                                function (jqXHR, textStatus, errorThrown) {
                                    dfd.reject(jqXHR, textStatus, errorThrown);
                                }
                            );
                        }
                    );
                    return this._enhancePromise(promise);
                }
                data.files = $.makeArray(data.files);
                if (data.files.length) {
                    return this._onSend(null, data);
                }
            }
            return this._getXHRPromise(false, data && data.context);
        }

    });

}));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJqcXVlcnkuZmlsZXVwbG9hZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogalF1ZXJ5IEZpbGUgVXBsb2FkIFBsdWdpbiA1LjQwLjFcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9ibHVlaW1wL2pRdWVyeS1GaWxlLVVwbG9hZFxuICpcbiAqIENvcHlyaWdodCAyMDEwLCBTZWJhc3RpYW4gVHNjaGFuXG4gKiBodHRwczovL2JsdWVpbXAubmV0XG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqL1xuXG4vKiBqc2hpbnQgbm9tZW46ZmFsc2UgKi9cbi8qIGdsb2JhbCBkZWZpbmUsIHdpbmRvdywgZG9jdW1lbnQsIGxvY2F0aW9uLCBCbG9iLCBGb3JtRGF0YSAqL1xuXG4oZnVuY3Rpb24gKGZhY3RvcnkpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICAvLyBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgQU1EIG1vZHVsZTpcbiAgICAgICAgZGVmaW5lKFtcbiAgICAgICAgICAgICdqcXVlcnknLFxuICAgICAgICAgICAgJ2pxdWVyeS51aS53aWRnZXQnXG4gICAgICAgIF0sIGZhY3RvcnkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJyb3dzZXIgZ2xvYmFsczpcbiAgICAgICAgZmFjdG9yeSh3aW5kb3cualF1ZXJ5KTtcbiAgICB9XG59KGZ1bmN0aW9uICgkKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gRGV0ZWN0IGZpbGUgaW5wdXQgc3VwcG9ydCwgYmFzZWQgb25cbiAgICAvLyBodHRwOi8vdmlsamFtaXMuY29tL2Jsb2cvMjAxMi9maWxlLXVwbG9hZC1zdXBwb3J0LW9uLW1vYmlsZS9cbiAgICAkLnN1cHBvcnQuZmlsZUlucHV0ID0gIShuZXcgUmVnRXhwKFxuICAgICAgICAvLyBIYW5kbGUgZGV2aWNlcyB3aGljaCBnaXZlIGZhbHNlIHBvc2l0aXZlcyBmb3IgdGhlIGZlYXR1cmUgZGV0ZWN0aW9uOlxuICAgICAgICAnKEFuZHJvaWQgKDFcXFxcLlswMTU2XXwyXFxcXC5bMDFdKSknICtcbiAgICAgICAgICAgICd8KFdpbmRvd3MgUGhvbmUgKE9TIDd8OFxcXFwuMCkpfChYQkxXUCl8KFp1bmVXUCl8KFdQRGVza3RvcCknICtcbiAgICAgICAgICAgICd8KHcoZWIpP09TQnJvd3Nlcil8KHdlYk9TKScgK1xuICAgICAgICAgICAgJ3woS2luZGxlLygxXFxcXC4wfDJcXFxcLlswNV18M1xcXFwuMCkpJ1xuICAgICkudGVzdCh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudCkgfHxcbiAgICAgICAgLy8gRmVhdHVyZSBkZXRlY3Rpb24gZm9yIGFsbCBvdGhlciBkZXZpY2VzOlxuICAgICAgICAkKCc8aW5wdXQgdHlwZT1cImZpbGVcIj4nKS5wcm9wKCdkaXNhYmxlZCcpKTtcblxuICAgIC8vIFRoZSBGaWxlUmVhZGVyIEFQSSBpcyBub3QgYWN0dWFsbHkgdXNlZCwgYnV0IHdvcmtzIGFzIGZlYXR1cmUgZGV0ZWN0aW9uLFxuICAgIC8vIGFzIHNvbWUgU2FmYXJpIHZlcnNpb25zICg1Pykgc3VwcG9ydCBYSFIgZmlsZSB1cGxvYWRzIHZpYSB0aGUgRm9ybURhdGEgQVBJLFxuICAgIC8vIGJ1dCBub3Qgbm9uLW11bHRpcGFydCBYSFIgZmlsZSB1cGxvYWRzLlxuICAgIC8vIHdpbmRvdy5YTUxIdHRwUmVxdWVzdFVwbG9hZCBpcyBub3QgYXZhaWxhYmxlIG9uIElFMTAsIHNvIHdlIGNoZWNrIGZvclxuICAgIC8vIHdpbmRvdy5Qcm9ncmVzc0V2ZW50IGluc3RlYWQgdG8gZGV0ZWN0IFhIUjIgZmlsZSB1cGxvYWQgY2FwYWJpbGl0eTpcbiAgICAkLnN1cHBvcnQueGhyRmlsZVVwbG9hZCA9ICEhKHdpbmRvdy5Qcm9ncmVzc0V2ZW50ICYmIHdpbmRvdy5GaWxlUmVhZGVyKTtcbiAgICAkLnN1cHBvcnQueGhyRm9ybURhdGFGaWxlVXBsb2FkID0gISF3aW5kb3cuRm9ybURhdGE7XG5cbiAgICAvLyBEZXRlY3Qgc3VwcG9ydCBmb3IgQmxvYiBzbGljaW5nIChyZXF1aXJlZCBmb3IgY2h1bmtlZCB1cGxvYWRzKTpcbiAgICAkLnN1cHBvcnQuYmxvYlNsaWNlID0gd2luZG93LkJsb2IgJiYgKEJsb2IucHJvdG90eXBlLnNsaWNlIHx8XG4gICAgICAgIEJsb2IucHJvdG90eXBlLndlYmtpdFNsaWNlIHx8IEJsb2IucHJvdG90eXBlLm1velNsaWNlKTtcblxuICAgIC8vIFRoZSBmaWxldXBsb2FkIHdpZGdldCBsaXN0ZW5zIGZvciBjaGFuZ2UgZXZlbnRzIG9uIGZpbGUgaW5wdXQgZmllbGRzIGRlZmluZWRcbiAgICAvLyB2aWEgZmlsZUlucHV0IHNldHRpbmcgYW5kIHBhc3RlIG9yIGRyb3AgZXZlbnRzIG9mIHRoZSBnaXZlbiBkcm9wWm9uZS5cbiAgICAvLyBJbiBhZGRpdGlvbiB0byB0aGUgZGVmYXVsdCBqUXVlcnkgV2lkZ2V0IG1ldGhvZHMsIHRoZSBmaWxldXBsb2FkIHdpZGdldFxuICAgIC8vIGV4cG9zZXMgdGhlIFwiYWRkXCIgYW5kIFwic2VuZFwiIG1ldGhvZHMsIHRvIGFkZCBvciBkaXJlY3RseSBzZW5kIGZpbGVzIHVzaW5nXG4gICAgLy8gdGhlIGZpbGV1cGxvYWQgQVBJLlxuICAgIC8vIEJ5IGRlZmF1bHQsIGZpbGVzIGFkZGVkIHZpYSBmaWxlIGlucHV0IHNlbGVjdGlvbiwgcGFzdGUsIGRyYWcgJiBkcm9wIG9yXG4gICAgLy8gXCJhZGRcIiBtZXRob2QgYXJlIHVwbG9hZGVkIGltbWVkaWF0ZWx5LCBidXQgaXQgaXMgcG9zc2libGUgdG8gb3ZlcnJpZGVcbiAgICAvLyB0aGUgXCJhZGRcIiBjYWxsYmFjayBvcHRpb24gdG8gcXVldWUgZmlsZSB1cGxvYWRzLlxuICAgICQud2lkZ2V0KCdibHVlaW1wLmZpbGV1cGxvYWQnLCB7XG5cbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgLy8gVGhlIGRyb3AgdGFyZ2V0IGVsZW1lbnQocyksIGJ5IHRoZSBkZWZhdWx0IHRoZSBjb21wbGV0ZSBkb2N1bWVudC5cbiAgICAgICAgICAgIC8vIFNldCB0byBudWxsIHRvIGRpc2FibGUgZHJhZyAmIGRyb3Agc3VwcG9ydDpcbiAgICAgICAgICAgIGRyb3Bab25lOiAkKGRvY3VtZW50KSxcbiAgICAgICAgICAgIC8vIFRoZSBwYXN0ZSB0YXJnZXQgZWxlbWVudChzKSwgYnkgdGhlIGRlZmF1bHQgdGhlIGNvbXBsZXRlIGRvY3VtZW50LlxuICAgICAgICAgICAgLy8gU2V0IHRvIG51bGwgdG8gZGlzYWJsZSBwYXN0ZSBzdXBwb3J0OlxuICAgICAgICAgICAgcGFzdGVab25lOiAkKGRvY3VtZW50KSxcbiAgICAgICAgICAgIC8vIFRoZSBmaWxlIGlucHV0IGZpZWxkKHMpLCB0aGF0IGFyZSBsaXN0ZW5lZCB0byBmb3IgY2hhbmdlIGV2ZW50cy5cbiAgICAgICAgICAgIC8vIElmIHVuZGVmaW5lZCwgaXQgaXMgc2V0IHRvIHRoZSBmaWxlIGlucHV0IGZpZWxkcyBpbnNpZGVcbiAgICAgICAgICAgIC8vIG9mIHRoZSB3aWRnZXQgZWxlbWVudCBvbiBwbHVnaW4gaW5pdGlhbGl6YXRpb24uXG4gICAgICAgICAgICAvLyBTZXQgdG8gbnVsbCB0byBkaXNhYmxlIHRoZSBjaGFuZ2UgbGlzdGVuZXIuXG4gICAgICAgICAgICBmaWxlSW5wdXQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8vIEJ5IGRlZmF1bHQsIHRoZSBmaWxlIGlucHV0IGZpZWxkIGlzIHJlcGxhY2VkIHdpdGggYSBjbG9uZSBhZnRlclxuICAgICAgICAgICAgLy8gZWFjaCBpbnB1dCBmaWVsZCBjaGFuZ2UgZXZlbnQuIFRoaXMgaXMgcmVxdWlyZWQgZm9yIGlmcmFtZSB0cmFuc3BvcnRcbiAgICAgICAgICAgIC8vIHF1ZXVlcyBhbmQgYWxsb3dzIGNoYW5nZSBldmVudHMgdG8gYmUgZmlyZWQgZm9yIHRoZSBzYW1lIGZpbGVcbiAgICAgICAgICAgIC8vIHNlbGVjdGlvbiwgYnV0IGNhbiBiZSBkaXNhYmxlZCBieSBzZXR0aW5nIHRoZSBmb2xsb3dpbmcgb3B0aW9uIHRvIGZhbHNlOlxuICAgICAgICAgICAgcmVwbGFjZUZpbGVJbnB1dDogdHJ1ZSxcbiAgICAgICAgICAgIC8vIFRoZSBwYXJhbWV0ZXIgbmFtZSBmb3IgdGhlIGZpbGUgZm9ybSBkYXRhICh0aGUgcmVxdWVzdCBhcmd1bWVudCBuYW1lKS5cbiAgICAgICAgICAgIC8vIElmIHVuZGVmaW5lZCBvciBlbXB0eSwgdGhlIG5hbWUgcHJvcGVydHkgb2YgdGhlIGZpbGUgaW5wdXQgZmllbGQgaXNcbiAgICAgICAgICAgIC8vIHVzZWQsIG9yIFwiZmlsZXNbXVwiIGlmIHRoZSBmaWxlIGlucHV0IG5hbWUgcHJvcGVydHkgaXMgYWxzbyBlbXB0eSxcbiAgICAgICAgICAgIC8vIGNhbiBiZSBhIHN0cmluZyBvciBhbiBhcnJheSBvZiBzdHJpbmdzOlxuICAgICAgICAgICAgcGFyYW1OYW1lOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAvLyBCeSBkZWZhdWx0LCBlYWNoIGZpbGUgb2YgYSBzZWxlY3Rpb24gaXMgdXBsb2FkZWQgdXNpbmcgYW4gaW5kaXZpZHVhbFxuICAgICAgICAgICAgLy8gcmVxdWVzdCBmb3IgWEhSIHR5cGUgdXBsb2Fkcy4gU2V0IHRvIGZhbHNlIHRvIHVwbG9hZCBmaWxlXG4gICAgICAgICAgICAvLyBzZWxlY3Rpb25zIGluIG9uZSByZXF1ZXN0IGVhY2g6XG4gICAgICAgICAgICBzaW5nbGVGaWxlVXBsb2FkczogdHJ1ZSxcbiAgICAgICAgICAgIC8vIFRvIGxpbWl0IHRoZSBudW1iZXIgb2YgZmlsZXMgdXBsb2FkZWQgd2l0aCBvbmUgWEhSIHJlcXVlc3QsXG4gICAgICAgICAgICAvLyBzZXQgdGhlIGZvbGxvd2luZyBvcHRpb24gdG8gYW4gaW50ZWdlciBncmVhdGVyIHRoYW4gMDpcbiAgICAgICAgICAgIGxpbWl0TXVsdGlGaWxlVXBsb2FkczogdW5kZWZpbmVkLFxuICAgICAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBvcHRpb24gbGltaXRzIHRoZSBudW1iZXIgb2YgZmlsZXMgdXBsb2FkZWQgd2l0aCBvbmVcbiAgICAgICAgICAgIC8vIFhIUiByZXF1ZXN0IHRvIGtlZXAgdGhlIHJlcXVlc3Qgc2l6ZSB1bmRlciBvciBlcXVhbCB0byB0aGUgZGVmaW5lZFxuICAgICAgICAgICAgLy8gbGltaXQgaW4gYnl0ZXM6XG4gICAgICAgICAgICBsaW1pdE11bHRpRmlsZVVwbG9hZFNpemU6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8vIE11bHRpcGFydCBmaWxlIHVwbG9hZHMgYWRkIGEgbnVtYmVyIG9mIGJ5dGVzIHRvIGVhY2ggdXBsb2FkZWQgZmlsZSxcbiAgICAgICAgICAgIC8vIHRoZXJlZm9yZSB0aGUgZm9sbG93aW5nIG9wdGlvbiBhZGRzIGFuIG92ZXJoZWFkIGZvciBlYWNoIGZpbGUgdXNlZFxuICAgICAgICAgICAgLy8gaW4gdGhlIGxpbWl0TXVsdGlGaWxlVXBsb2FkU2l6ZSBjb25maWd1cmF0aW9uOlxuICAgICAgICAgICAgbGltaXRNdWx0aUZpbGVVcGxvYWRTaXplT3ZlcmhlYWQ6IDUxMixcbiAgICAgICAgICAgIC8vIFNldCB0aGUgZm9sbG93aW5nIG9wdGlvbiB0byB0cnVlIHRvIGlzc3VlIGFsbCBmaWxlIHVwbG9hZCByZXF1ZXN0c1xuICAgICAgICAgICAgLy8gaW4gYSBzZXF1ZW50aWFsIG9yZGVyOlxuICAgICAgICAgICAgc2VxdWVudGlhbFVwbG9hZHM6IGZhbHNlLFxuICAgICAgICAgICAgLy8gVG8gbGltaXQgdGhlIG51bWJlciBvZiBjb25jdXJyZW50IHVwbG9hZHMsXG4gICAgICAgICAgICAvLyBzZXQgdGhlIGZvbGxvd2luZyBvcHRpb24gdG8gYW4gaW50ZWdlciBncmVhdGVyIHRoYW4gMDpcbiAgICAgICAgICAgIGxpbWl0Q29uY3VycmVudFVwbG9hZHM6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8vIFNldCB0aGUgZm9sbG93aW5nIG9wdGlvbiB0byB0cnVlIHRvIGZvcmNlIGlmcmFtZSB0cmFuc3BvcnQgdXBsb2FkczpcbiAgICAgICAgICAgIGZvcmNlSWZyYW1lVHJhbnNwb3J0OiBmYWxzZSxcbiAgICAgICAgICAgIC8vIFNldCB0aGUgZm9sbG93aW5nIG9wdGlvbiB0byB0aGUgbG9jYXRpb24gb2YgYSByZWRpcmVjdCB1cmwgb24gdGhlXG4gICAgICAgICAgICAvLyBvcmlnaW4gc2VydmVyLCBmb3IgY3Jvc3MtZG9tYWluIGlmcmFtZSB0cmFuc3BvcnQgdXBsb2FkczpcbiAgICAgICAgICAgIHJlZGlyZWN0OiB1bmRlZmluZWQsXG4gICAgICAgICAgICAvLyBUaGUgcGFyYW1ldGVyIG5hbWUgZm9yIHRoZSByZWRpcmVjdCB1cmwsIHNlbnQgYXMgcGFydCBvZiB0aGUgZm9ybVxuICAgICAgICAgICAgLy8gZGF0YSBhbmQgc2V0IHRvICdyZWRpcmVjdCcgaWYgdGhpcyBvcHRpb24gaXMgZW1wdHk6XG4gICAgICAgICAgICByZWRpcmVjdFBhcmFtTmFtZTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgLy8gU2V0IHRoZSBmb2xsb3dpbmcgb3B0aW9uIHRvIHRoZSBsb2NhdGlvbiBvZiBhIHBvc3RNZXNzYWdlIHdpbmRvdyxcbiAgICAgICAgICAgIC8vIHRvIGVuYWJsZSBwb3N0TWVzc2FnZSB0cmFuc3BvcnQgdXBsb2FkczpcbiAgICAgICAgICAgIHBvc3RNZXNzYWdlOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAvLyBCeSBkZWZhdWx0LCBYSFIgZmlsZSB1cGxvYWRzIGFyZSBzZW50IGFzIG11bHRpcGFydC9mb3JtLWRhdGEuXG4gICAgICAgICAgICAvLyBUaGUgaWZyYW1lIHRyYW5zcG9ydCBpcyBhbHdheXMgdXNpbmcgbXVsdGlwYXJ0L2Zvcm0tZGF0YS5cbiAgICAgICAgICAgIC8vIFNldCB0byBmYWxzZSB0byBlbmFibGUgbm9uLW11bHRpcGFydCBYSFIgdXBsb2FkczpcbiAgICAgICAgICAgIG11bHRpcGFydDogdHJ1ZSxcbiAgICAgICAgICAgIC8vIFRvIHVwbG9hZCBsYXJnZSBmaWxlcyBpbiBzbWFsbGVyIGNodW5rcywgc2V0IHRoZSBmb2xsb3dpbmcgb3B0aW9uXG4gICAgICAgICAgICAvLyB0byBhIHByZWZlcnJlZCBtYXhpbXVtIGNodW5rIHNpemUuIElmIHNldCB0byAwLCBudWxsIG9yIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8vIG9yIHRoZSBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgdGhlIHJlcXVpcmVkIEJsb2IgQVBJLCBmaWxlcyB3aWxsXG4gICAgICAgICAgICAvLyBiZSB1cGxvYWRlZCBhcyBhIHdob2xlLlxuICAgICAgICAgICAgbWF4Q2h1bmtTaXplOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAvLyBXaGVuIGEgbm9uLW11bHRpcGFydCB1cGxvYWQgb3IgYSBjaHVua2VkIG11bHRpcGFydCB1cGxvYWQgaGFzIGJlZW5cbiAgICAgICAgICAgIC8vIGFib3J0ZWQsIHRoaXMgb3B0aW9uIGNhbiBiZSB1c2VkIHRvIHJlc3VtZSB0aGUgdXBsb2FkIGJ5IHNldHRpbmdcbiAgICAgICAgICAgIC8vIGl0IHRvIHRoZSBzaXplIG9mIHRoZSBhbHJlYWR5IHVwbG9hZGVkIGJ5dGVzLiBUaGlzIG9wdGlvbiBpcyBtb3N0XG4gICAgICAgICAgICAvLyB1c2VmdWwgd2hlbiBtb2RpZnlpbmcgdGhlIG9wdGlvbnMgb2JqZWN0IGluc2lkZSBvZiB0aGUgXCJhZGRcIiBvclxuICAgICAgICAgICAgLy8gXCJzZW5kXCIgY2FsbGJhY2tzLCBhcyB0aGUgb3B0aW9ucyBhcmUgY2xvbmVkIGZvciBlYWNoIGZpbGUgdXBsb2FkLlxuICAgICAgICAgICAgdXBsb2FkZWRCeXRlczogdW5kZWZpbmVkLFxuICAgICAgICAgICAgLy8gQnkgZGVmYXVsdCwgZmFpbGVkIChhYm9ydCBvciBlcnJvcikgZmlsZSB1cGxvYWRzIGFyZSByZW1vdmVkIGZyb20gdGhlXG4gICAgICAgICAgICAvLyBnbG9iYWwgcHJvZ3Jlc3MgY2FsY3VsYXRpb24uIFNldCB0aGUgZm9sbG93aW5nIG9wdGlvbiB0byBmYWxzZSB0b1xuICAgICAgICAgICAgLy8gcHJldmVudCByZWNhbGN1bGF0aW5nIHRoZSBnbG9iYWwgcHJvZ3Jlc3MgZGF0YTpcbiAgICAgICAgICAgIHJlY2FsY3VsYXRlUHJvZ3Jlc3M6IHRydWUsXG4gICAgICAgICAgICAvLyBJbnRlcnZhbCBpbiBtaWxsaXNlY29uZHMgdG8gY2FsY3VsYXRlIGFuZCB0cmlnZ2VyIHByb2dyZXNzIGV2ZW50czpcbiAgICAgICAgICAgIHByb2dyZXNzSW50ZXJ2YWw6IDEwMCxcbiAgICAgICAgICAgIC8vIEludGVydmFsIGluIG1pbGxpc2Vjb25kcyB0byBjYWxjdWxhdGUgcHJvZ3Jlc3MgYml0cmF0ZTpcbiAgICAgICAgICAgIGJpdHJhdGVJbnRlcnZhbDogNTAwLFxuICAgICAgICAgICAgLy8gQnkgZGVmYXVsdCwgdXBsb2FkcyBhcmUgc3RhcnRlZCBhdXRvbWF0aWNhbGx5IHdoZW4gYWRkaW5nIGZpbGVzOlxuICAgICAgICAgICAgYXV0b1VwbG9hZDogdHJ1ZSxcblxuICAgICAgICAgICAgLy8gRXJyb3IgYW5kIGluZm8gbWVzc2FnZXM6XG4gICAgICAgICAgICBtZXNzYWdlczoge1xuICAgICAgICAgICAgICAgIHVwbG9hZGVkQnl0ZXM6ICdVcGxvYWRlZCBieXRlcyBleGNlZWQgZmlsZSBzaXplJ1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLy8gVHJhbnNsYXRpb24gZnVuY3Rpb24sIGdldHMgdGhlIG1lc3NhZ2Uga2V5IHRvIGJlIHRyYW5zbGF0ZWRcbiAgICAgICAgICAgIC8vIGFuZCBhbiBvYmplY3Qgd2l0aCBjb250ZXh0IHNwZWNpZmljIGRhdGEgYXMgYXJndW1lbnRzOlxuICAgICAgICAgICAgaTE4bjogZnVuY3Rpb24gKG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gdGhpcy5tZXNzYWdlc1ttZXNzYWdlXSB8fCBtZXNzYWdlLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgJC5lYWNoKGNvbnRleHQsIGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gbWVzc2FnZS5yZXBsYWNlKCd7JyArIGtleSArICd9JywgdmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1lc3NhZ2U7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvLyBBZGRpdGlvbmFsIGZvcm0gZGF0YSB0byBiZSBzZW50IGFsb25nIHdpdGggdGhlIGZpbGUgdXBsb2FkcyBjYW4gYmUgc2V0XG4gICAgICAgICAgICAvLyB1c2luZyB0aGlzIG9wdGlvbiwgd2hpY2ggYWNjZXB0cyBhbiBhcnJheSBvZiBvYmplY3RzIHdpdGggbmFtZSBhbmRcbiAgICAgICAgICAgIC8vIHZhbHVlIHByb3BlcnRpZXMsIGEgZnVuY3Rpb24gcmV0dXJuaW5nIHN1Y2ggYW4gYXJyYXksIGEgRm9ybURhdGFcbiAgICAgICAgICAgIC8vIG9iamVjdCAoZm9yIFhIUiBmaWxlIHVwbG9hZHMpLCBvciBhIHNpbXBsZSBvYmplY3QuXG4gICAgICAgICAgICAvLyBUaGUgZm9ybSBvZiB0aGUgZmlyc3QgZmlsZUlucHV0IGlzIGdpdmVuIGFzIHBhcmFtZXRlciB0byB0aGUgZnVuY3Rpb246XG4gICAgICAgICAgICBmb3JtRGF0YTogZnVuY3Rpb24gKGZvcm0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm9ybS5zZXJpYWxpemVBcnJheSgpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLy8gVGhlIGFkZCBjYWxsYmFjayBpcyBpbnZva2VkIGFzIHNvb24gYXMgZmlsZXMgYXJlIGFkZGVkIHRvIHRoZSBmaWxldXBsb2FkXG4gICAgICAgICAgICAvLyB3aWRnZXQgKHZpYSBmaWxlIGlucHV0IHNlbGVjdGlvbiwgZHJhZyAmIGRyb3AsIHBhc3RlIG9yIGFkZCBBUEkgY2FsbCkuXG4gICAgICAgICAgICAvLyBJZiB0aGUgc2luZ2xlRmlsZVVwbG9hZHMgb3B0aW9uIGlzIGVuYWJsZWQsIHRoaXMgY2FsbGJhY2sgd2lsbCBiZVxuICAgICAgICAgICAgLy8gY2FsbGVkIG9uY2UgZm9yIGVhY2ggZmlsZSBpbiB0aGUgc2VsZWN0aW9uIGZvciBYSFIgZmlsZSB1cGxvYWRzLCBlbHNlXG4gICAgICAgICAgICAvLyBvbmNlIGZvciBlYWNoIGZpbGUgc2VsZWN0aW9uLlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIFRoZSB1cGxvYWQgc3RhcnRzIHdoZW4gdGhlIHN1Ym1pdCBtZXRob2QgaXMgaW52b2tlZCBvbiB0aGUgZGF0YSBwYXJhbWV0ZXIuXG4gICAgICAgICAgICAvLyBUaGUgZGF0YSBvYmplY3QgY29udGFpbnMgYSBmaWxlcyBwcm9wZXJ0eSBob2xkaW5nIHRoZSBhZGRlZCBmaWxlc1xuICAgICAgICAgICAgLy8gYW5kIGFsbG93cyB5b3UgdG8gb3ZlcnJpZGUgcGx1Z2luIG9wdGlvbnMgYXMgd2VsbCBhcyBkZWZpbmUgYWpheCBzZXR0aW5ncy5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBMaXN0ZW5lcnMgZm9yIHRoaXMgY2FsbGJhY2sgY2FuIGFsc28gYmUgYm91bmQgdGhlIGZvbGxvd2luZyB3YXk6XG4gICAgICAgICAgICAvLyAuYmluZCgnZmlsZXVwbG9hZGFkZCcsIGZ1bmMpO1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIGRhdGEuc3VibWl0KCkgcmV0dXJucyBhIFByb21pc2Ugb2JqZWN0IGFuZCBhbGxvd3MgdG8gYXR0YWNoIGFkZGl0aW9uYWxcbiAgICAgICAgICAgIC8vIGhhbmRsZXJzIHVzaW5nIGpRdWVyeSdzIERlZmVycmVkIGNhbGxiYWNrczpcbiAgICAgICAgICAgIC8vIGRhdGEuc3VibWl0KCkuZG9uZShmdW5jKS5mYWlsKGZ1bmMpLmFsd2F5cyhmdW5jKTtcbiAgICAgICAgICAgIGFkZDogZnVuY3Rpb24gKGUsIGRhdGEpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChkYXRhLmF1dG9VcGxvYWQgfHwgKGRhdGEuYXV0b1VwbG9hZCAhPT0gZmFsc2UgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICQodGhpcykuZmlsZXVwbG9hZCgnb3B0aW9uJywgJ2F1dG9VcGxvYWQnKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wcm9jZXNzKCkuZG9uZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnN1Ym1pdCgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvLyBPdGhlciBjYWxsYmFja3M6XG5cbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGZvciB0aGUgc3VibWl0IGV2ZW50IG9mIGVhY2ggZmlsZSB1cGxvYWQ6XG4gICAgICAgICAgICAvLyBzdWJtaXQ6IGZ1bmN0aW9uIChlLCBkYXRhKSB7fSwgLy8gLmJpbmQoJ2ZpbGV1cGxvYWRzdWJtaXQnLCBmdW5jKTtcblxuICAgICAgICAgICAgLy8gQ2FsbGJhY2sgZm9yIHRoZSBzdGFydCBvZiBlYWNoIGZpbGUgdXBsb2FkIHJlcXVlc3Q6XG4gICAgICAgICAgICAvLyBzZW5kOiBmdW5jdGlvbiAoZSwgZGF0YSkge30sIC8vIC5iaW5kKCdmaWxldXBsb2Fkc2VuZCcsIGZ1bmMpO1xuXG4gICAgICAgICAgICAvLyBDYWxsYmFjayBmb3Igc3VjY2Vzc2Z1bCB1cGxvYWRzOlxuICAgICAgICAgICAgLy8gZG9uZTogZnVuY3Rpb24gKGUsIGRhdGEpIHt9LCAvLyAuYmluZCgnZmlsZXVwbG9hZGRvbmUnLCBmdW5jKTtcblxuICAgICAgICAgICAgLy8gQ2FsbGJhY2sgZm9yIGZhaWxlZCAoYWJvcnQgb3IgZXJyb3IpIHVwbG9hZHM6XG4gICAgICAgICAgICAvLyBmYWlsOiBmdW5jdGlvbiAoZSwgZGF0YSkge30sIC8vIC5iaW5kKCdmaWxldXBsb2FkZmFpbCcsIGZ1bmMpO1xuXG4gICAgICAgICAgICAvLyBDYWxsYmFjayBmb3IgY29tcGxldGVkIChzdWNjZXNzLCBhYm9ydCBvciBlcnJvcikgcmVxdWVzdHM6XG4gICAgICAgICAgICAvLyBhbHdheXM6IGZ1bmN0aW9uIChlLCBkYXRhKSB7fSwgLy8gLmJpbmQoJ2ZpbGV1cGxvYWRhbHdheXMnLCBmdW5jKTtcblxuICAgICAgICAgICAgLy8gQ2FsbGJhY2sgZm9yIHVwbG9hZCBwcm9ncmVzcyBldmVudHM6XG4gICAgICAgICAgICAvLyBwcm9ncmVzczogZnVuY3Rpb24gKGUsIGRhdGEpIHt9LCAvLyAuYmluZCgnZmlsZXVwbG9hZHByb2dyZXNzJywgZnVuYyk7XG5cbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGZvciBnbG9iYWwgdXBsb2FkIHByb2dyZXNzIGV2ZW50czpcbiAgICAgICAgICAgIC8vIHByb2dyZXNzYWxsOiBmdW5jdGlvbiAoZSwgZGF0YSkge30sIC8vIC5iaW5kKCdmaWxldXBsb2FkcHJvZ3Jlc3NhbGwnLCBmdW5jKTtcblxuICAgICAgICAgICAgLy8gQ2FsbGJhY2sgZm9yIHVwbG9hZHMgc3RhcnQsIGVxdWl2YWxlbnQgdG8gdGhlIGdsb2JhbCBhamF4U3RhcnQgZXZlbnQ6XG4gICAgICAgICAgICAvLyBzdGFydDogZnVuY3Rpb24gKGUpIHt9LCAvLyAuYmluZCgnZmlsZXVwbG9hZHN0YXJ0JywgZnVuYyk7XG5cbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGZvciB1cGxvYWRzIHN0b3AsIGVxdWl2YWxlbnQgdG8gdGhlIGdsb2JhbCBhamF4U3RvcCBldmVudDpcbiAgICAgICAgICAgIC8vIHN0b3A6IGZ1bmN0aW9uIChlKSB7fSwgLy8gLmJpbmQoJ2ZpbGV1cGxvYWRzdG9wJywgZnVuYyk7XG5cbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGZvciBjaGFuZ2UgZXZlbnRzIG9mIHRoZSBmaWxlSW5wdXQocyk6XG4gICAgICAgICAgICAvLyBjaGFuZ2U6IGZ1bmN0aW9uIChlLCBkYXRhKSB7fSwgLy8gLmJpbmQoJ2ZpbGV1cGxvYWRjaGFuZ2UnLCBmdW5jKTtcblxuICAgICAgICAgICAgLy8gQ2FsbGJhY2sgZm9yIHBhc3RlIGV2ZW50cyB0byB0aGUgcGFzdGVab25lKHMpOlxuICAgICAgICAgICAgLy8gcGFzdGU6IGZ1bmN0aW9uIChlLCBkYXRhKSB7fSwgLy8gLmJpbmQoJ2ZpbGV1cGxvYWRwYXN0ZScsIGZ1bmMpO1xuXG4gICAgICAgICAgICAvLyBDYWxsYmFjayBmb3IgZHJvcCBldmVudHMgb2YgdGhlIGRyb3Bab25lKHMpOlxuICAgICAgICAgICAgLy8gZHJvcDogZnVuY3Rpb24gKGUsIGRhdGEpIHt9LCAvLyAuYmluZCgnZmlsZXVwbG9hZGRyb3AnLCBmdW5jKTtcblxuICAgICAgICAgICAgLy8gQ2FsbGJhY2sgZm9yIGRyYWdvdmVyIGV2ZW50cyBvZiB0aGUgZHJvcFpvbmUocyk6XG4gICAgICAgICAgICAvLyBkcmFnb3ZlcjogZnVuY3Rpb24gKGUpIHt9LCAvLyAuYmluZCgnZmlsZXVwbG9hZGRyYWdvdmVyJywgZnVuYyk7XG5cbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGZvciB0aGUgc3RhcnQgb2YgZWFjaCBjaHVuayB1cGxvYWQgcmVxdWVzdDpcbiAgICAgICAgICAgIC8vIGNodW5rc2VuZDogZnVuY3Rpb24gKGUsIGRhdGEpIHt9LCAvLyAuYmluZCgnZmlsZXVwbG9hZGNodW5rc2VuZCcsIGZ1bmMpO1xuXG4gICAgICAgICAgICAvLyBDYWxsYmFjayBmb3Igc3VjY2Vzc2Z1bCBjaHVuayB1cGxvYWRzOlxuICAgICAgICAgICAgLy8gY2h1bmtkb25lOiBmdW5jdGlvbiAoZSwgZGF0YSkge30sIC8vIC5iaW5kKCdmaWxldXBsb2FkY2h1bmtkb25lJywgZnVuYyk7XG5cbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGZvciBmYWlsZWQgKGFib3J0IG9yIGVycm9yKSBjaHVuayB1cGxvYWRzOlxuICAgICAgICAgICAgLy8gY2h1bmtmYWlsOiBmdW5jdGlvbiAoZSwgZGF0YSkge30sIC8vIC5iaW5kKCdmaWxldXBsb2FkY2h1bmtmYWlsJywgZnVuYyk7XG5cbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGZvciBjb21wbGV0ZWQgKHN1Y2Nlc3MsIGFib3J0IG9yIGVycm9yKSBjaHVuayB1cGxvYWQgcmVxdWVzdHM6XG4gICAgICAgICAgICAvLyBjaHVua2Fsd2F5czogZnVuY3Rpb24gKGUsIGRhdGEpIHt9LCAvLyAuYmluZCgnZmlsZXVwbG9hZGNodW5rYWx3YXlzJywgZnVuYyk7XG5cbiAgICAgICAgICAgIC8vIFRoZSBwbHVnaW4gb3B0aW9ucyBhcmUgdXNlZCBhcyBzZXR0aW5ncyBvYmplY3QgZm9yIHRoZSBhamF4IGNhbGxzLlxuICAgICAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBhcmUgalF1ZXJ5IGFqYXggc2V0dGluZ3MgcmVxdWlyZWQgZm9yIHRoZSBmaWxlIHVwbG9hZHM6XG4gICAgICAgICAgICBwcm9jZXNzRGF0YTogZmFsc2UsXG4gICAgICAgICAgICBjb250ZW50VHlwZTogZmFsc2UsXG4gICAgICAgICAgICBjYWNoZTogZmFsc2VcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBBIGxpc3Qgb2Ygb3B0aW9ucyB0aGF0IHJlcXVpcmUgcmVpbml0aWFsaXppbmcgZXZlbnQgbGlzdGVuZXJzIGFuZC9vclxuICAgICAgICAvLyBzcGVjaWFsIGluaXRpYWxpemF0aW9uIGNvZGU6XG4gICAgICAgIF9zcGVjaWFsT3B0aW9uczogW1xuICAgICAgICAgICAgJ2ZpbGVJbnB1dCcsXG4gICAgICAgICAgICAnZHJvcFpvbmUnLFxuICAgICAgICAgICAgJ3Bhc3RlWm9uZScsXG4gICAgICAgICAgICAnbXVsdGlwYXJ0JyxcbiAgICAgICAgICAgICdmb3JjZUlmcmFtZVRyYW5zcG9ydCdcbiAgICAgICAgXSxcblxuICAgICAgICBfYmxvYlNsaWNlOiAkLnN1cHBvcnQuYmxvYlNsaWNlICYmIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBzbGljZSA9IHRoaXMuc2xpY2UgfHwgdGhpcy53ZWJraXRTbGljZSB8fCB0aGlzLm1velNsaWNlO1xuICAgICAgICAgICAgcmV0dXJuIHNsaWNlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX0JpdHJhdGVUaW1lcjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy50aW1lc3RhbXAgPSAoKERhdGUubm93KSA/IERhdGUubm93KCkgOiAobmV3IERhdGUoKSkuZ2V0VGltZSgpKTtcbiAgICAgICAgICAgIHRoaXMubG9hZGVkID0gMDtcbiAgICAgICAgICAgIHRoaXMuYml0cmF0ZSA9IDA7XG4gICAgICAgICAgICB0aGlzLmdldEJpdHJhdGUgPSBmdW5jdGlvbiAobm93LCBsb2FkZWQsIGludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRpbWVEaWZmID0gbm93IC0gdGhpcy50aW1lc3RhbXA7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmJpdHJhdGUgfHwgIWludGVydmFsIHx8IHRpbWVEaWZmID4gaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5iaXRyYXRlID0gKGxvYWRlZCAtIHRoaXMubG9hZGVkKSAqICgxMDAwIC8gdGltZURpZmYpICogODtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2FkZWQgPSBsb2FkZWQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGltZXN0YW1wID0gbm93O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5iaXRyYXRlO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcblxuICAgICAgICBfaXNYSFJVcGxvYWQ6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gIW9wdGlvbnMuZm9yY2VJZnJhbWVUcmFuc3BvcnQgJiZcbiAgICAgICAgICAgICAgICAoKCFvcHRpb25zLm11bHRpcGFydCAmJiAkLnN1cHBvcnQueGhyRmlsZVVwbG9hZCkgfHxcbiAgICAgICAgICAgICAgICAkLnN1cHBvcnQueGhyRm9ybURhdGFGaWxlVXBsb2FkKTtcbiAgICAgICAgfSxcblxuICAgICAgICBfZ2V0Rm9ybURhdGE6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIgZm9ybURhdGE7XG4gICAgICAgICAgICBpZiAoJC50eXBlKG9wdGlvbnMuZm9ybURhdGEpID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuZm9ybURhdGEob3B0aW9ucy5mb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgkLmlzQXJyYXkob3B0aW9ucy5mb3JtRGF0YSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mb3JtRGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgkLnR5cGUob3B0aW9ucy5mb3JtRGF0YSkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgZm9ybURhdGEgPSBbXTtcbiAgICAgICAgICAgICAgICAkLmVhY2gob3B0aW9ucy5mb3JtRGF0YSwgZnVuY3Rpb24gKG5hbWUsIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvcm1EYXRhLnB1c2goe25hbWU6IG5hbWUsIHZhbHVlOiB2YWx1ZX0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBmb3JtRGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfSxcblxuICAgICAgICBfZ2V0VG90YWw6IGZ1bmN0aW9uIChmaWxlcykge1xuICAgICAgICAgICAgdmFyIHRvdGFsID0gMDtcbiAgICAgICAgICAgICQuZWFjaChmaWxlcywgZnVuY3Rpb24gKGluZGV4LCBmaWxlKSB7XG4gICAgICAgICAgICAgICAgdG90YWwgKz0gZmlsZS5zaXplIHx8IDE7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB0b3RhbDtcbiAgICAgICAgfSxcblxuICAgICAgICBfaW5pdFByb2dyZXNzT2JqZWN0OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICB2YXIgcHJvZ3Jlc3MgPSB7XG4gICAgICAgICAgICAgICAgbG9hZGVkOiAwLFxuICAgICAgICAgICAgICAgIHRvdGFsOiAwLFxuICAgICAgICAgICAgICAgIGJpdHJhdGU6IDBcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAob2JqLl9wcm9ncmVzcykge1xuICAgICAgICAgICAgICAgICQuZXh0ZW5kKG9iai5fcHJvZ3Jlc3MsIHByb2dyZXNzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb2JqLl9wcm9ncmVzcyA9IHByb2dyZXNzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIF9pbml0UmVzcG9uc2VPYmplY3Q6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHZhciBwcm9wO1xuICAgICAgICAgICAgaWYgKG9iai5fcmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHByb3AgaW4gb2JqLl9yZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAob2JqLl9yZXNwb25zZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG9iai5fcmVzcG9uc2VbcHJvcF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9iai5fcmVzcG9uc2UgPSB7fTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBfb25Qcm9ncmVzczogZnVuY3Rpb24gKGUsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmIChlLmxlbmd0aENvbXB1dGFibGUpIHtcbiAgICAgICAgICAgICAgICB2YXIgbm93ID0gKChEYXRlLm5vdykgPyBEYXRlLm5vdygpIDogKG5ldyBEYXRlKCkpLmdldFRpbWUoKSksXG4gICAgICAgICAgICAgICAgICAgIGxvYWRlZDtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5fdGltZSAmJiBkYXRhLnByb2dyZXNzSW50ZXJ2YWwgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIChub3cgLSBkYXRhLl90aW1lIDwgZGF0YS5wcm9ncmVzc0ludGVydmFsKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgZS5sb2FkZWQgIT09IGUudG90YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkYXRhLl90aW1lID0gbm93O1xuICAgICAgICAgICAgICAgIGxvYWRlZCA9IE1hdGguZmxvb3IoXG4gICAgICAgICAgICAgICAgICAgIGUubG9hZGVkIC8gZS50b3RhbCAqIChkYXRhLmNodW5rU2l6ZSB8fCBkYXRhLl9wcm9ncmVzcy50b3RhbClcbiAgICAgICAgICAgICAgICApICsgKGRhdGEudXBsb2FkZWRCeXRlcyB8fCAwKTtcbiAgICAgICAgICAgICAgICAvLyBBZGQgdGhlIGRpZmZlcmVuY2UgZnJvbSB0aGUgcHJldmlvdXNseSBsb2FkZWQgc3RhdGVcbiAgICAgICAgICAgICAgICAvLyB0byB0aGUgZ2xvYmFsIGxvYWRlZCBjb3VudGVyOlxuICAgICAgICAgICAgICAgIHRoaXMuX3Byb2dyZXNzLmxvYWRlZCArPSAobG9hZGVkIC0gZGF0YS5fcHJvZ3Jlc3MubG9hZGVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcm9ncmVzcy5iaXRyYXRlID0gdGhpcy5fYml0cmF0ZVRpbWVyLmdldEJpdHJhdGUoXG4gICAgICAgICAgICAgICAgICAgIG5vdyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcHJvZ3Jlc3MubG9hZGVkLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLmJpdHJhdGVJbnRlcnZhbFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgZGF0YS5fcHJvZ3Jlc3MubG9hZGVkID0gZGF0YS5sb2FkZWQgPSBsb2FkZWQ7XG4gICAgICAgICAgICAgICAgZGF0YS5fcHJvZ3Jlc3MuYml0cmF0ZSA9IGRhdGEuYml0cmF0ZSA9IGRhdGEuX2JpdHJhdGVUaW1lci5nZXRCaXRyYXRlKFxuICAgICAgICAgICAgICAgICAgICBub3csXG4gICAgICAgICAgICAgICAgICAgIGxvYWRlZCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5iaXRyYXRlSW50ZXJ2YWxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIC8vIFRyaWdnZXIgYSBjdXN0b20gcHJvZ3Jlc3MgZXZlbnQgd2l0aCBhIHRvdGFsIGRhdGEgcHJvcGVydHkgc2V0XG4gICAgICAgICAgICAgICAgLy8gdG8gdGhlIGZpbGUgc2l6ZShzKSBvZiB0aGUgY3VycmVudCB1cGxvYWQgYW5kIGEgbG9hZGVkIGRhdGFcbiAgICAgICAgICAgICAgICAvLyBwcm9wZXJ0eSBjYWxjdWxhdGVkIGFjY29yZGluZ2x5OlxuICAgICAgICAgICAgICAgIHRoaXMuX3RyaWdnZXIoXG4gICAgICAgICAgICAgICAgICAgICdwcm9ncmVzcycsXG4gICAgICAgICAgICAgICAgICAgICQuRXZlbnQoJ3Byb2dyZXNzJywge2RlbGVnYXRlZEV2ZW50OiBlfSksXG4gICAgICAgICAgICAgICAgICAgIGRhdGFcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIC8vIFRyaWdnZXIgYSBnbG9iYWwgcHJvZ3Jlc3MgZXZlbnQgZm9yIGFsbCBjdXJyZW50IGZpbGUgdXBsb2FkcyxcbiAgICAgICAgICAgICAgICAvLyBpbmNsdWRpbmcgYWpheCBjYWxscyBxdWV1ZWQgZm9yIHNlcXVlbnRpYWwgZmlsZSB1cGxvYWRzOlxuICAgICAgICAgICAgICAgIHRoaXMuX3RyaWdnZXIoXG4gICAgICAgICAgICAgICAgICAgICdwcm9ncmVzc2FsbCcsXG4gICAgICAgICAgICAgICAgICAgICQuRXZlbnQoJ3Byb2dyZXNzYWxsJywge2RlbGVnYXRlZEV2ZW50OiBlfSksXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Byb2dyZXNzXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBfaW5pdFByb2dyZXNzTGlzdGVuZXI6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXMsXG4gICAgICAgICAgICAgICAgeGhyID0gb3B0aW9ucy54aHIgPyBvcHRpb25zLnhocigpIDogJC5hamF4U2V0dGluZ3MueGhyKCk7XG4gICAgICAgICAgICAvLyBBY2Nlc3NzIHRvIHRoZSBuYXRpdmUgWEhSIG9iamVjdCBpcyByZXF1aXJlZCB0byBhZGQgZXZlbnQgbGlzdGVuZXJzXG4gICAgICAgICAgICAvLyBmb3IgdGhlIHVwbG9hZCBwcm9ncmVzcyBldmVudDpcbiAgICAgICAgICAgIGlmICh4aHIudXBsb2FkKSB7XG4gICAgICAgICAgICAgICAgJCh4aHIudXBsb2FkKS5iaW5kKCdwcm9ncmVzcycsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvZSA9IGUub3JpZ2luYWxFdmVudDtcbiAgICAgICAgICAgICAgICAgICAgLy8gTWFrZSBzdXJlIHRoZSBwcm9ncmVzcyBldmVudCBwcm9wZXJ0aWVzIGdldCBjb3BpZWQgb3ZlcjpcbiAgICAgICAgICAgICAgICAgICAgZS5sZW5ndGhDb21wdXRhYmxlID0gb2UubGVuZ3RoQ29tcHV0YWJsZTtcbiAgICAgICAgICAgICAgICAgICAgZS5sb2FkZWQgPSBvZS5sb2FkZWQ7XG4gICAgICAgICAgICAgICAgICAgIGUudG90YWwgPSBvZS50b3RhbDtcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5fb25Qcm9ncmVzcyhlLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnhociA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHhocjtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIF9pc0luc3RhbmNlT2Y6IGZ1bmN0aW9uICh0eXBlLCBvYmopIHtcbiAgICAgICAgICAgIC8vIENyb3NzLWZyYW1lIGluc3RhbmNlb2YgY2hlY2tcbiAgICAgICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgJyArIHR5cGUgKyAnXSc7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2luaXRYSFJEYXRhOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzLFxuICAgICAgICAgICAgICAgIGZvcm1EYXRhLFxuICAgICAgICAgICAgICAgIGZpbGUgPSBvcHRpb25zLmZpbGVzWzBdLFxuICAgICAgICAgICAgICAgIC8vIElnbm9yZSBub24tbXVsdGlwYXJ0IHNldHRpbmcgaWYgbm90IHN1cHBvcnRlZDpcbiAgICAgICAgICAgICAgICBtdWx0aXBhcnQgPSBvcHRpb25zLm11bHRpcGFydCB8fCAhJC5zdXBwb3J0LnhockZpbGVVcGxvYWQsXG4gICAgICAgICAgICAgICAgcGFyYW1OYW1lID0gJC50eXBlKG9wdGlvbnMucGFyYW1OYW1lKSA9PT0gJ2FycmF5JyA/XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMucGFyYW1OYW1lWzBdIDogb3B0aW9ucy5wYXJhbU5hbWU7XG4gICAgICAgICAgICBvcHRpb25zLmhlYWRlcnMgPSAkLmV4dGVuZCh7fSwgb3B0aW9ucy5oZWFkZXJzKTtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNvbnRlbnRSYW5nZSkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMuaGVhZGVyc1snQ29udGVudC1SYW5nZSddID0gb3B0aW9ucy5jb250ZW50UmFuZ2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW11bHRpcGFydCB8fCBvcHRpb25zLmJsb2IgfHwgIXRoaXMuX2lzSW5zdGFuY2VPZignRmlsZScsIGZpbGUpKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5oZWFkZXJzWydDb250ZW50LURpc3Bvc2l0aW9uJ10gPSAnYXR0YWNobWVudDsgZmlsZW5hbWU9XCInICtcbiAgICAgICAgICAgICAgICAgICAgZW5jb2RlVVJJKGZpbGUubmFtZSkgKyAnXCInO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFtdWx0aXBhcnQpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLmNvbnRlbnRUeXBlID0gZmlsZS50eXBlIHx8ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nO1xuICAgICAgICAgICAgICAgIG9wdGlvbnMuZGF0YSA9IG9wdGlvbnMuYmxvYiB8fCBmaWxlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgkLnN1cHBvcnQueGhyRm9ybURhdGFGaWxlVXBsb2FkKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMucG9zdE1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gd2luZG93LnBvc3RNZXNzYWdlIGRvZXMgbm90IGFsbG93IHNlbmRpbmcgRm9ybURhdGFcbiAgICAgICAgICAgICAgICAgICAgLy8gb2JqZWN0cywgc28gd2UganVzdCBhZGQgdGhlIEZpbGUvQmxvYiBvYmplY3RzIHRvXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBmb3JtRGF0YSBhcnJheSBhbmQgbGV0IHRoZSBwb3N0TWVzc2FnZSB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIHRoZSBGb3JtRGF0YSBvYmplY3Qgb3V0IG9mIHRoaXMgYXJyYXk6XG4gICAgICAgICAgICAgICAgICAgIGZvcm1EYXRhID0gdGhpcy5fZ2V0Rm9ybURhdGEob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmJsb2IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvcm1EYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHBhcmFtTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogb3B0aW9ucy5ibG9iXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICQuZWFjaChvcHRpb25zLmZpbGVzLCBmdW5jdGlvbiAoaW5kZXgsIGZpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3JtRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogKCQudHlwZShvcHRpb25zLnBhcmFtTmFtZSkgPT09ICdhcnJheScgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMucGFyYW1OYW1lW2luZGV4XSkgfHwgcGFyYW1OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZmlsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhhdC5faXNJbnN0YW5jZU9mKCdGb3JtRGF0YScsIG9wdGlvbnMuZm9ybURhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3JtRGF0YSA9IG9wdGlvbnMuZm9ybURhdGE7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3JtRGF0YSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgJC5lYWNoKHRoaXMuX2dldEZvcm1EYXRhKG9wdGlvbnMpLCBmdW5jdGlvbiAoaW5kZXgsIGZpZWxkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKGZpZWxkLm5hbWUsIGZpZWxkLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmJsb2IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvcm1EYXRhLmFwcGVuZChwYXJhbU5hbWUsIG9wdGlvbnMuYmxvYiwgZmlsZS5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICQuZWFjaChvcHRpb25zLmZpbGVzLCBmdW5jdGlvbiAoaW5kZXgsIGZpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGNoZWNrIGFsbG93cyB0aGUgdGVzdHMgdG8gcnVuIHdpdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkdW1teSBvYmplY3RzOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGF0Ll9pc0luc3RhbmNlT2YoJ0ZpbGUnLCBmaWxlKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5faXNJbnN0YW5jZU9mKCdCbG9iJywgZmlsZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKCQudHlwZShvcHRpb25zLnBhcmFtTmFtZSkgPT09ICdhcnJheScgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnBhcmFtTmFtZVtpbmRleF0pIHx8IHBhcmFtTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlLnVwbG9hZE5hbWUgfHwgZmlsZS5uYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5kYXRhID0gZm9ybURhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBCbG9iIHJlZmVyZW5jZSBpcyBub3QgbmVlZGVkIGFueW1vcmUsIGZyZWUgbWVtb3J5OlxuICAgICAgICAgICAgb3B0aW9ucy5ibG9iID0gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICBfaW5pdElmcmFtZVNldHRpbmdzOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIHRhcmdldEhvc3QgPSAkKCc8YT48L2E+JykucHJvcCgnaHJlZicsIG9wdGlvbnMudXJsKS5wcm9wKCdob3N0Jyk7XG4gICAgICAgICAgICAvLyBTZXR0aW5nIHRoZSBkYXRhVHlwZSB0byBpZnJhbWUgZW5hYmxlcyB0aGUgaWZyYW1lIHRyYW5zcG9ydDpcbiAgICAgICAgICAgIG9wdGlvbnMuZGF0YVR5cGUgPSAnaWZyYW1lICcgKyAob3B0aW9ucy5kYXRhVHlwZSB8fCAnJyk7XG4gICAgICAgICAgICAvLyBUaGUgaWZyYW1lIHRyYW5zcG9ydCBhY2NlcHRzIGEgc2VyaWFsaXplZCBhcnJheSBhcyBmb3JtIGRhdGE6XG4gICAgICAgICAgICBvcHRpb25zLmZvcm1EYXRhID0gdGhpcy5fZ2V0Rm9ybURhdGEob3B0aW9ucyk7XG4gICAgICAgICAgICAvLyBBZGQgcmVkaXJlY3QgdXJsIHRvIGZvcm0gZGF0YSBvbiBjcm9zcy1kb21haW4gdXBsb2FkczpcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnJlZGlyZWN0ICYmIHRhcmdldEhvc3QgJiYgdGFyZ2V0SG9zdCAhPT0gbG9jYXRpb24uaG9zdCkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMuZm9ybURhdGEucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG9wdGlvbnMucmVkaXJlY3RQYXJhbU5hbWUgfHwgJ3JlZGlyZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IG9wdGlvbnMucmVkaXJlY3RcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBfaW5pdERhdGFTZXR0aW5nczogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc1hIUlVwbG9hZChvcHRpb25zKSkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY2h1bmtlZFVwbG9hZChvcHRpb25zLCB0cnVlKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMuZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5faW5pdFhIUkRhdGEob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faW5pdFByb2dyZXNzTGlzdGVuZXIob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnBvc3RNZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNldHRpbmcgdGhlIGRhdGFUeXBlIHRvIHBvc3RtZXNzYWdlIGVuYWJsZXMgdGhlXG4gICAgICAgICAgICAgICAgICAgIC8vIHBvc3RNZXNzYWdlIHRyYW5zcG9ydDpcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kYXRhVHlwZSA9ICdwb3N0bWVzc2FnZSAnICsgKG9wdGlvbnMuZGF0YVR5cGUgfHwgJycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5pdElmcmFtZVNldHRpbmdzKG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIF9nZXRQYXJhbU5hbWU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIgZmlsZUlucHV0ID0gJChvcHRpb25zLmZpbGVJbnB1dCksXG4gICAgICAgICAgICAgICAgcGFyYW1OYW1lID0gb3B0aW9ucy5wYXJhbU5hbWU7XG4gICAgICAgICAgICBpZiAoIXBhcmFtTmFtZSkge1xuICAgICAgICAgICAgICAgIHBhcmFtTmFtZSA9IFtdO1xuICAgICAgICAgICAgICAgIGZpbGVJbnB1dC5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlucHV0ID0gJCh0aGlzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgPSBpbnB1dC5wcm9wKCduYW1lJykgfHwgJ2ZpbGVzW10nLFxuICAgICAgICAgICAgICAgICAgICAgICAgaSA9IChpbnB1dC5wcm9wKCdmaWxlcycpIHx8IFsxXSkubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1OYW1lLnB1c2gobmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpIC09IDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIXBhcmFtTmFtZS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1OYW1lID0gW2ZpbGVJbnB1dC5wcm9wKCduYW1lJykgfHwgJ2ZpbGVzW10nXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCEkLmlzQXJyYXkocGFyYW1OYW1lKSkge1xuICAgICAgICAgICAgICAgIHBhcmFtTmFtZSA9IFtwYXJhbU5hbWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHBhcmFtTmFtZTtcbiAgICAgICAgfSxcblxuICAgICAgICBfaW5pdEZvcm1TZXR0aW5nczogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIC8vIFJldHJpZXZlIG1pc3Npbmcgb3B0aW9ucyBmcm9tIHRoZSBpbnB1dCBmaWVsZCBhbmQgdGhlXG4gICAgICAgICAgICAvLyBhc3NvY2lhdGVkIGZvcm0sIGlmIGF2YWlsYWJsZTpcbiAgICAgICAgICAgIGlmICghb3B0aW9ucy5mb3JtIHx8ICFvcHRpb25zLmZvcm0ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5mb3JtID0gJChvcHRpb25zLmZpbGVJbnB1dC5wcm9wKCdmb3JtJykpO1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSBnaXZlbiBmaWxlIGlucHV0IGRvZXNuJ3QgaGF2ZSBhbiBhc3NvY2lhdGVkIGZvcm0sXG4gICAgICAgICAgICAgICAgLy8gdXNlIHRoZSBkZWZhdWx0IHdpZGdldCBmaWxlIGlucHV0J3MgZm9ybTpcbiAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMuZm9ybS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5mb3JtID0gJCh0aGlzLm9wdGlvbnMuZmlsZUlucHV0LnByb3AoJ2Zvcm0nKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgb3B0aW9ucy5wYXJhbU5hbWUgPSB0aGlzLl9nZXRQYXJhbU5hbWUob3B0aW9ucyk7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMudXJsKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy51cmwgPSBvcHRpb25zLmZvcm0ucHJvcCgnYWN0aW9uJykgfHwgbG9jYXRpb24uaHJlZjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFRoZSBIVFRQIHJlcXVlc3QgbWV0aG9kIG11c3QgYmUgXCJQT1NUXCIgb3IgXCJQVVRcIjpcbiAgICAgICAgICAgIG9wdGlvbnMudHlwZSA9IChvcHRpb25zLnR5cGUgfHxcbiAgICAgICAgICAgICAgICAoJC50eXBlKG9wdGlvbnMuZm9ybS5wcm9wKCdtZXRob2QnKSkgPT09ICdzdHJpbmcnICYmXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZm9ybS5wcm9wKCdtZXRob2QnKSkgfHwgJydcbiAgICAgICAgICAgICAgICApLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy50eXBlICE9PSAnUE9TVCcgJiYgb3B0aW9ucy50eXBlICE9PSAnUFVUJyAmJlxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnR5cGUgIT09ICdQQVRDSCcpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnR5cGUgPSAnUE9TVCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuZm9ybUFjY2VwdENoYXJzZXQpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLmZvcm1BY2NlcHRDaGFyc2V0ID0gb3B0aW9ucy5mb3JtLmF0dHIoJ2FjY2VwdC1jaGFyc2V0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2dldEFKQVhTZXR0aW5nczogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBvcHRpb25zID0gJC5leHRlbmQoe30sIHRoaXMub3B0aW9ucywgZGF0YSk7XG4gICAgICAgICAgICB0aGlzLl9pbml0Rm9ybVNldHRpbmdzKG9wdGlvbnMpO1xuICAgICAgICAgICAgdGhpcy5faW5pdERhdGFTZXR0aW5ncyhvcHRpb25zKTtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIGpRdWVyeSAxLjYgZG9lc24ndCBwcm92aWRlIC5zdGF0ZSgpLFxuICAgICAgICAvLyB3aGlsZSBqUXVlcnkgMS44KyByZW1vdmVkIC5pc1JlamVjdGVkKCkgYW5kIC5pc1Jlc29sdmVkKCk6XG4gICAgICAgIF9nZXREZWZlcnJlZFN0YXRlOiBmdW5jdGlvbiAoZGVmZXJyZWQpIHtcbiAgICAgICAgICAgIGlmIChkZWZlcnJlZC5zdGF0ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5zdGF0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRlZmVycmVkLmlzUmVzb2x2ZWQoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAncmVzb2x2ZWQnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRlZmVycmVkLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAncmVqZWN0ZWQnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICdwZW5kaW5nJztcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBNYXBzIGpxWEhSIGNhbGxiYWNrcyB0byB0aGUgZXF1aXZhbGVudFxuICAgICAgICAvLyBtZXRob2RzIG9mIHRoZSBnaXZlbiBQcm9taXNlIG9iamVjdDpcbiAgICAgICAgX2VuaGFuY2VQcm9taXNlOiBmdW5jdGlvbiAocHJvbWlzZSkge1xuICAgICAgICAgICAgcHJvbWlzZS5zdWNjZXNzID0gcHJvbWlzZS5kb25lO1xuICAgICAgICAgICAgcHJvbWlzZS5lcnJvciA9IHByb21pc2UuZmFpbDtcbiAgICAgICAgICAgIHByb21pc2UuY29tcGxldGUgPSBwcm9taXNlLmFsd2F5cztcbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIENyZWF0ZXMgYW5kIHJldHVybnMgYSBQcm9taXNlIG9iamVjdCBlbmhhbmNlZCB3aXRoXG4gICAgICAgIC8vIHRoZSBqcVhIUiBtZXRob2RzIGFib3J0LCBzdWNjZXNzLCBlcnJvciBhbmQgY29tcGxldGU6XG4gICAgICAgIF9nZXRYSFJQcm9taXNlOiBmdW5jdGlvbiAocmVzb2x2ZU9yUmVqZWN0LCBjb250ZXh0LCBhcmdzKSB7XG4gICAgICAgICAgICB2YXIgZGZkID0gJC5EZWZlcnJlZCgpLFxuICAgICAgICAgICAgICAgIHByb21pc2UgPSBkZmQucHJvbWlzZSgpO1xuICAgICAgICAgICAgY29udGV4dCA9IGNvbnRleHQgfHwgdGhpcy5vcHRpb25zLmNvbnRleHQgfHwgcHJvbWlzZTtcbiAgICAgICAgICAgIGlmIChyZXNvbHZlT3JSZWplY3QgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBkZmQucmVzb2x2ZVdpdGgoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlc29sdmVPclJlamVjdCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBkZmQucmVqZWN0V2l0aChjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByb21pc2UuYWJvcnQgPSBkZmQucHJvbWlzZTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9lbmhhbmNlUHJvbWlzZShwcm9taXNlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBBZGRzIGNvbnZlbmllbmNlIG1ldGhvZHMgdG8gdGhlIGRhdGEgY2FsbGJhY2sgYXJndW1lbnQ6XG4gICAgICAgIF9hZGRDb252ZW5pZW5jZU1ldGhvZHM6IGZ1bmN0aW9uIChlLCBkYXRhKSB7XG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXMsXG4gICAgICAgICAgICAgICAgZ2V0UHJvbWlzZSA9IGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkLkRlZmVycmVkKCkucmVzb2x2ZVdpdGgodGhhdCwgYXJncykucHJvbWlzZSgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhLnByb2Nlc3MgPSBmdW5jdGlvbiAocmVzb2x2ZUZ1bmMsIHJlamVjdEZ1bmMpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzb2x2ZUZ1bmMgfHwgcmVqZWN0RnVuYykge1xuICAgICAgICAgICAgICAgICAgICBkYXRhLl9wcm9jZXNzUXVldWUgPSB0aGlzLl9wcm9jZXNzUXVldWUgPVxuICAgICAgICAgICAgICAgICAgICAgICAgKHRoaXMuX3Byb2Nlc3NRdWV1ZSB8fCBnZXRQcm9taXNlKFt0aGlzXSkpLnBpcGUoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5lcnJvclRocm93bikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICQuRGVmZXJyZWQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZWplY3RXaXRoKHRoYXQsIFtkYXRhXSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRQcm9taXNlKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgKS5waXBlKHJlc29sdmVGdW5jLCByZWplY3RGdW5jKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3Byb2Nlc3NRdWV1ZSB8fCBnZXRQcm9taXNlKFt0aGlzXSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YS5zdWJtaXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUoKSAhPT0gJ3BlbmRpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEuanFYSFIgPSB0aGlzLmpxWEhSID1cbiAgICAgICAgICAgICAgICAgICAgICAgICh0aGF0Ll90cmlnZ2VyKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzdWJtaXQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQuRXZlbnQoJ3N1Ym1pdCcsIHtkZWxlZ2F0ZWRFdmVudDogZX0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgICkgIT09IGZhbHNlKSAmJiB0aGF0Ll9vblNlbmQoZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmpxWEhSIHx8IHRoYXQuX2dldFhIUlByb21pc2UoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhLmFib3J0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmpxWEhSKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmpxWEhSLmFib3J0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JUaHJvd24gPSAnYWJvcnQnO1xuICAgICAgICAgICAgICAgIHRoYXQuX3RyaWdnZXIoJ2ZhaWwnLCBudWxsLCB0aGlzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhhdC5fZ2V0WEhSUHJvbWlzZShmYWxzZSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YS5zdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5qcVhIUikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhhdC5fZ2V0RGVmZXJyZWRTdGF0ZSh0aGlzLmpxWEhSKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3Byb2Nlc3NRdWV1ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhhdC5fZ2V0RGVmZXJyZWRTdGF0ZSh0aGlzLl9wcm9jZXNzUXVldWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhLnByb2Nlc3NpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICF0aGlzLmpxWEhSICYmIHRoaXMuX3Byb2Nlc3NRdWV1ZSAmJiB0aGF0XG4gICAgICAgICAgICAgICAgICAgIC5fZ2V0RGVmZXJyZWRTdGF0ZSh0aGlzLl9wcm9jZXNzUXVldWUpID09PSAncGVuZGluZyc7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YS5wcm9ncmVzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fcHJvZ3Jlc3M7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YS5yZXNwb25zZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVzcG9uc2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIFBhcnNlcyB0aGUgUmFuZ2UgaGVhZGVyIGZyb20gdGhlIHNlcnZlciByZXNwb25zZVxuICAgICAgICAvLyBhbmQgcmV0dXJucyB0aGUgdXBsb2FkZWQgYnl0ZXM6XG4gICAgICAgIF9nZXRVcGxvYWRlZEJ5dGVzOiBmdW5jdGlvbiAoanFYSFIpIHtcbiAgICAgICAgICAgIHZhciByYW5nZSA9IGpxWEhSLmdldFJlc3BvbnNlSGVhZGVyKCdSYW5nZScpLFxuICAgICAgICAgICAgICAgIHBhcnRzID0gcmFuZ2UgJiYgcmFuZ2Uuc3BsaXQoJy0nKSxcbiAgICAgICAgICAgICAgICB1cHBlckJ5dGVzUG9zID0gcGFydHMgJiYgcGFydHMubGVuZ3RoID4gMSAmJlxuICAgICAgICAgICAgICAgICAgICBwYXJzZUludChwYXJ0c1sxXSwgMTApO1xuICAgICAgICAgICAgcmV0dXJuIHVwcGVyQnl0ZXNQb3MgJiYgdXBwZXJCeXRlc1BvcyArIDE7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gVXBsb2FkcyBhIGZpbGUgaW4gbXVsdGlwbGUsIHNlcXVlbnRpYWwgcmVxdWVzdHNcbiAgICAgICAgLy8gYnkgc3BsaXR0aW5nIHRoZSBmaWxlIHVwIGluIG11bHRpcGxlIGJsb2IgY2h1bmtzLlxuICAgICAgICAvLyBJZiB0aGUgc2Vjb25kIHBhcmFtZXRlciBpcyB0cnVlLCBvbmx5IHRlc3RzIGlmIHRoZSBmaWxlXG4gICAgICAgIC8vIHNob3VsZCBiZSB1cGxvYWRlZCBpbiBjaHVua3MsIGJ1dCBkb2VzIG5vdCBpbnZva2UgYW55XG4gICAgICAgIC8vIHVwbG9hZCByZXF1ZXN0czpcbiAgICAgICAgX2NodW5rZWRVcGxvYWQ6IGZ1bmN0aW9uIChvcHRpb25zLCB0ZXN0T25seSkge1xuICAgICAgICAgICAgb3B0aW9ucy51cGxvYWRlZEJ5dGVzID0gb3B0aW9ucy51cGxvYWRlZEJ5dGVzIHx8IDA7XG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXMsXG4gICAgICAgICAgICAgICAgZmlsZSA9IG9wdGlvbnMuZmlsZXNbMF0sXG4gICAgICAgICAgICAgICAgZnMgPSBmaWxlLnNpemUsXG4gICAgICAgICAgICAgICAgdWIgPSBvcHRpb25zLnVwbG9hZGVkQnl0ZXMsXG4gICAgICAgICAgICAgICAgbWNzID0gb3B0aW9ucy5tYXhDaHVua1NpemUgfHwgZnMsXG4gICAgICAgICAgICAgICAgc2xpY2UgPSB0aGlzLl9ibG9iU2xpY2UsXG4gICAgICAgICAgICAgICAgZGZkID0gJC5EZWZlcnJlZCgpLFxuICAgICAgICAgICAgICAgIHByb21pc2UgPSBkZmQucHJvbWlzZSgpLFxuICAgICAgICAgICAgICAgIGpxWEhSLFxuICAgICAgICAgICAgICAgIHVwbG9hZDtcbiAgICAgICAgICAgIGlmICghKHRoaXMuX2lzWEhSVXBsb2FkKG9wdGlvbnMpICYmIHNsaWNlICYmICh1YiB8fCBtY3MgPCBmcykpIHx8XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0ZXN0T25seSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHViID49IGZzKSB7XG4gICAgICAgICAgICAgICAgZmlsZS5lcnJvciA9IG9wdGlvbnMuaTE4bigndXBsb2FkZWRCeXRlcycpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXRYSFJQcm9taXNlKFxuICAgICAgICAgICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5jb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICBbbnVsbCwgJ2Vycm9yJywgZmlsZS5lcnJvcl1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVGhlIGNodW5rIHVwbG9hZCBtZXRob2Q6XG4gICAgICAgICAgICB1cGxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gQ2xvbmUgdGhlIG9wdGlvbnMgb2JqZWN0IGZvciBlYWNoIGNodW5rIHVwbG9hZDpcbiAgICAgICAgICAgICAgICB2YXIgbyA9ICQuZXh0ZW5kKHt9LCBvcHRpb25zKSxcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudExvYWRlZCA9IG8uX3Byb2dyZXNzLmxvYWRlZDtcbiAgICAgICAgICAgICAgICBvLmJsb2IgPSBzbGljZS5jYWxsKFxuICAgICAgICAgICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgICAgICAgICB1YixcbiAgICAgICAgICAgICAgICAgICAgdWIgKyBtY3MsXG4gICAgICAgICAgICAgICAgICAgIGZpbGUudHlwZVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgLy8gU3RvcmUgdGhlIGN1cnJlbnQgY2h1bmsgc2l6ZSwgYXMgdGhlIGJsb2IgaXRzZWxmXG4gICAgICAgICAgICAgICAgLy8gd2lsbCBiZSBkZXJlZmVyZW5jZWQgYWZ0ZXIgZGF0YSBwcm9jZXNzaW5nOlxuICAgICAgICAgICAgICAgIG8uY2h1bmtTaXplID0gby5ibG9iLnNpemU7XG4gICAgICAgICAgICAgICAgLy8gRXhwb3NlIHRoZSBjaHVuayBieXRlcyBwb3NpdGlvbiByYW5nZTpcbiAgICAgICAgICAgICAgICBvLmNvbnRlbnRSYW5nZSA9ICdieXRlcyAnICsgdWIgKyAnLScgK1xuICAgICAgICAgICAgICAgICAgICAodWIgKyBvLmNodW5rU2l6ZSAtIDEpICsgJy8nICsgZnM7XG4gICAgICAgICAgICAgICAgLy8gUHJvY2VzcyB0aGUgdXBsb2FkIGRhdGEgKHRoZSBibG9iIGFuZCBwb3RlbnRpYWwgZm9ybSBkYXRhKTpcbiAgICAgICAgICAgICAgICB0aGF0Ll9pbml0WEhSRGF0YShvKTtcbiAgICAgICAgICAgICAgICAvLyBBZGQgcHJvZ3Jlc3MgbGlzdGVuZXJzIGZvciB0aGlzIGNodW5rIHVwbG9hZDpcbiAgICAgICAgICAgICAgICB0aGF0Ll9pbml0UHJvZ3Jlc3NMaXN0ZW5lcihvKTtcbiAgICAgICAgICAgICAgICBqcVhIUiA9ICgodGhhdC5fdHJpZ2dlcignY2h1bmtzZW5kJywgbnVsbCwgbykgIT09IGZhbHNlICYmICQuYWpheChvKSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuX2dldFhIUlByb21pc2UoZmFsc2UsIG8uY29udGV4dCkpXG4gICAgICAgICAgICAgICAgICAgIC5kb25lKGZ1bmN0aW9uIChyZXN1bHQsIHRleHRTdGF0dXMsIGpxWEhSKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1YiA9IHRoYXQuX2dldFVwbG9hZGVkQnl0ZXMoanFYSFIpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKHViICsgby5jaHVua1NpemUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIGEgcHJvZ3Jlc3MgZXZlbnQgaWYgbm8gZmluYWwgcHJvZ3Jlc3MgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdpdGggbG9hZGVkIGVxdWFsaW5nIHRvdGFsIGhhcyBiZWVuIHRyaWdnZXJlZFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZm9yIHRoaXMgY2h1bms6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudExvYWRlZCArIG8uY2h1bmtTaXplIC0gby5fcHJvZ3Jlc3MubG9hZGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5fb25Qcm9ncmVzcygkLkV2ZW50KCdwcm9ncmVzcycsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGVuZ3RoQ29tcHV0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9hZGVkOiB1YiAtIG8udXBsb2FkZWRCeXRlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG90YWw6IHViIC0gby51cGxvYWRlZEJ5dGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSksIG8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy51cGxvYWRlZEJ5dGVzID0gby51cGxvYWRlZEJ5dGVzID0gdWI7XG4gICAgICAgICAgICAgICAgICAgICAgICBvLnJlc3VsdCA9IHJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIG8udGV4dFN0YXR1cyA9IHRleHRTdGF0dXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBvLmpxWEhSID0ganFYSFI7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0Ll90cmlnZ2VyKCdjaHVua2RvbmUnLCBudWxsLCBvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuX3RyaWdnZXIoJ2NodW5rYWx3YXlzJywgbnVsbCwgbyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodWIgPCBmcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZpbGUgdXBsb2FkIG5vdCB5ZXQgY29tcGxldGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29udGludWUgd2l0aCB0aGUgbmV4dCBjaHVuazpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGxvYWQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGZkLnJlc29sdmVXaXRoKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLmNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtyZXN1bHQsIHRleHRTdGF0dXMsIGpxWEhSXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5mYWlsKGZ1bmN0aW9uIChqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG8uanFYSFIgPSBqcVhIUjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG8udGV4dFN0YXR1cyA9IHRleHRTdGF0dXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBvLmVycm9yVGhyb3duID0gZXJyb3JUaHJvd247XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0Ll90cmlnZ2VyKCdjaHVua2ZhaWwnLCBudWxsLCBvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuX3RyaWdnZXIoJ2NodW5rYWx3YXlzJywgbnVsbCwgbyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZmQucmVqZWN0V2l0aChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLmNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgW2pxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bl1cbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMuX2VuaGFuY2VQcm9taXNlKHByb21pc2UpO1xuICAgICAgICAgICAgcHJvbWlzZS5hYm9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ganFYSFIuYWJvcnQoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB1cGxvYWQoKTtcbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIF9iZWZvcmVTZW5kOiBmdW5jdGlvbiAoZSwgZGF0YSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2FjdGl2ZSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIC8vIHRoZSBzdGFydCBjYWxsYmFjayBpcyB0cmlnZ2VyZWQgd2hlbiBhbiB1cGxvYWQgc3RhcnRzXG4gICAgICAgICAgICAgICAgLy8gYW5kIG5vIG90aGVyIHVwbG9hZHMgYXJlIGN1cnJlbnRseSBydW5uaW5nLFxuICAgICAgICAgICAgICAgIC8vIGVxdWl2YWxlbnQgdG8gdGhlIGdsb2JhbCBhamF4U3RhcnQgZXZlbnQ6XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJpZ2dlcignc3RhcnQnKTtcbiAgICAgICAgICAgICAgICAvLyBTZXQgdGltZXIgZm9yIGdsb2JhbCBiaXRyYXRlIHByb2dyZXNzIGNhbGN1bGF0aW9uOlxuICAgICAgICAgICAgICAgIHRoaXMuX2JpdHJhdGVUaW1lciA9IG5ldyB0aGlzLl9CaXRyYXRlVGltZXIoKTtcbiAgICAgICAgICAgICAgICAvLyBSZXNldCB0aGUgZ2xvYmFsIHByb2dyZXNzIHZhbHVlczpcbiAgICAgICAgICAgICAgICB0aGlzLl9wcm9ncmVzcy5sb2FkZWQgPSB0aGlzLl9wcm9ncmVzcy50b3RhbCA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJvZ3Jlc3MuYml0cmF0ZSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhlIGNvbnRhaW5lciBvYmplY3RzIGZvciB0aGUgLnJlc3BvbnNlKCkgYW5kXG4gICAgICAgICAgICAvLyAucHJvZ3Jlc3MoKSBtZXRob2RzIG9uIHRoZSBkYXRhIG9iamVjdCBhcmUgYXZhaWxhYmxlXG4gICAgICAgICAgICAvLyBhbmQgcmVzZXQgdG8gdGhlaXIgaW5pdGlhbCBzdGF0ZTpcbiAgICAgICAgICAgIHRoaXMuX2luaXRSZXNwb25zZU9iamVjdChkYXRhKTtcbiAgICAgICAgICAgIHRoaXMuX2luaXRQcm9ncmVzc09iamVjdChkYXRhKTtcbiAgICAgICAgICAgIGRhdGEuX3Byb2dyZXNzLmxvYWRlZCA9IGRhdGEubG9hZGVkID0gZGF0YS51cGxvYWRlZEJ5dGVzIHx8IDA7XG4gICAgICAgICAgICBkYXRhLl9wcm9ncmVzcy50b3RhbCA9IGRhdGEudG90YWwgPSB0aGlzLl9nZXRUb3RhbChkYXRhLmZpbGVzKSB8fCAxO1xuICAgICAgICAgICAgZGF0YS5fcHJvZ3Jlc3MuYml0cmF0ZSA9IGRhdGEuYml0cmF0ZSA9IDA7XG4gICAgICAgICAgICB0aGlzLl9hY3RpdmUgKz0gMTtcbiAgICAgICAgICAgIC8vIEluaXRpYWxpemUgdGhlIGdsb2JhbCBwcm9ncmVzcyB2YWx1ZXM6XG4gICAgICAgICAgICB0aGlzLl9wcm9ncmVzcy5sb2FkZWQgKz0gZGF0YS5sb2FkZWQ7XG4gICAgICAgICAgICB0aGlzLl9wcm9ncmVzcy50b3RhbCArPSBkYXRhLnRvdGFsO1xuICAgICAgICB9LFxuXG4gICAgICAgIF9vbkRvbmU6IGZ1bmN0aW9uIChyZXN1bHQsIHRleHRTdGF0dXMsIGpxWEhSLCBvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIgdG90YWwgPSBvcHRpb25zLl9wcm9ncmVzcy50b3RhbCxcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9IG9wdGlvbnMuX3Jlc3BvbnNlO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuX3Byb2dyZXNzLmxvYWRlZCA8IHRvdGFsKSB7XG4gICAgICAgICAgICAgICAgLy8gQ3JlYXRlIGEgcHJvZ3Jlc3MgZXZlbnQgaWYgbm8gZmluYWwgcHJvZ3Jlc3MgZXZlbnRcbiAgICAgICAgICAgICAgICAvLyB3aXRoIGxvYWRlZCBlcXVhbGluZyB0b3RhbCBoYXMgYmVlbiB0cmlnZ2VyZWQ6XG4gICAgICAgICAgICAgICAgdGhpcy5fb25Qcm9ncmVzcygkLkV2ZW50KCdwcm9ncmVzcycsIHtcbiAgICAgICAgICAgICAgICAgICAgbGVuZ3RoQ29tcHV0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgbG9hZGVkOiB0b3RhbCxcbiAgICAgICAgICAgICAgICAgICAgdG90YWw6IHRvdGFsXG4gICAgICAgICAgICAgICAgfSksIG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzcG9uc2UucmVzdWx0ID0gb3B0aW9ucy5yZXN1bHQgPSByZXN1bHQ7XG4gICAgICAgICAgICByZXNwb25zZS50ZXh0U3RhdHVzID0gb3B0aW9ucy50ZXh0U3RhdHVzID0gdGV4dFN0YXR1cztcbiAgICAgICAgICAgIHJlc3BvbnNlLmpxWEhSID0gb3B0aW9ucy5qcVhIUiA9IGpxWEhSO1xuICAgICAgICAgICAgdGhpcy5fdHJpZ2dlcignZG9uZScsIG51bGwsIG9wdGlvbnMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIF9vbkZhaWw6IGZ1bmN0aW9uIChqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24sIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciByZXNwb25zZSA9IG9wdGlvbnMuX3Jlc3BvbnNlO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMucmVjYWxjdWxhdGVQcm9ncmVzcykge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSB0aGUgZmFpbGVkIChlcnJvciBvciBhYm9ydCkgZmlsZSB1cGxvYWQgZnJvbVxuICAgICAgICAgICAgICAgIC8vIHRoZSBnbG9iYWwgcHJvZ3Jlc3MgY2FsY3VsYXRpb246XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJvZ3Jlc3MubG9hZGVkIC09IG9wdGlvbnMuX3Byb2dyZXNzLmxvYWRlZDtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcm9ncmVzcy50b3RhbCAtPSBvcHRpb25zLl9wcm9ncmVzcy50b3RhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3BvbnNlLmpxWEhSID0gb3B0aW9ucy5qcVhIUiA9IGpxWEhSO1xuICAgICAgICAgICAgcmVzcG9uc2UudGV4dFN0YXR1cyA9IG9wdGlvbnMudGV4dFN0YXR1cyA9IHRleHRTdGF0dXM7XG4gICAgICAgICAgICByZXNwb25zZS5lcnJvclRocm93biA9IG9wdGlvbnMuZXJyb3JUaHJvd24gPSBlcnJvclRocm93bjtcbiAgICAgICAgICAgIHRoaXMuX3RyaWdnZXIoJ2ZhaWwnLCBudWxsLCBvcHRpb25zKTtcbiAgICAgICAgfSxcblxuICAgICAgICBfb25BbHdheXM6IGZ1bmN0aW9uIChqcVhIUm9yUmVzdWx0LCB0ZXh0U3RhdHVzLCBqcVhIUm9yRXJyb3IsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIC8vIGpxWEhSb3JSZXN1bHQsIHRleHRTdGF0dXMgYW5kIGpxWEhSb3JFcnJvciBhcmUgYWRkZWQgdG8gdGhlXG4gICAgICAgICAgICAvLyBvcHRpb25zIG9iamVjdCB2aWEgZG9uZSBhbmQgZmFpbCBjYWxsYmFja3NcbiAgICAgICAgICAgIHRoaXMuX3RyaWdnZXIoJ2Fsd2F5cycsIG51bGwsIG9wdGlvbnMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIF9vblNlbmQ6IGZ1bmN0aW9uIChlLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoIWRhdGEuc3VibWl0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkQ29udmVuaWVuY2VNZXRob2RzKGUsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzLFxuICAgICAgICAgICAgICAgIGpxWEhSLFxuICAgICAgICAgICAgICAgIGFib3J0ZWQsXG4gICAgICAgICAgICAgICAgc2xvdCxcbiAgICAgICAgICAgICAgICBwaXBlLFxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSB0aGF0Ll9nZXRBSkFYU2V0dGluZ3MoZGF0YSksXG4gICAgICAgICAgICAgICAgc2VuZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5fc2VuZGluZyArPSAxO1xuICAgICAgICAgICAgICAgICAgICAvLyBTZXQgdGltZXIgZm9yIGJpdHJhdGUgcHJvZ3Jlc3MgY2FsY3VsYXRpb246XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuX2JpdHJhdGVUaW1lciA9IG5ldyB0aGF0Ll9CaXRyYXRlVGltZXIoKTtcbiAgICAgICAgICAgICAgICAgICAganFYSFIgPSBqcVhIUiB8fCAoXG4gICAgICAgICAgICAgICAgICAgICAgICAoKGFib3J0ZWQgfHwgdGhhdC5fdHJpZ2dlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc2VuZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJC5FdmVudCgnc2VuZCcsIHtkZWxlZ2F0ZWRFdmVudDogZX0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICkgPT09IGZhbHNlKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5fZ2V0WEhSUHJvbWlzZShmYWxzZSwgb3B0aW9ucy5jb250ZXh0LCBhYm9ydGVkKSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuX2NodW5rZWRVcGxvYWQob3B0aW9ucykgfHwgJC5hamF4KG9wdGlvbnMpXG4gICAgICAgICAgICAgICAgICAgICkuZG9uZShmdW5jdGlvbiAocmVzdWx0LCB0ZXh0U3RhdHVzLCBqcVhIUikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5fb25Eb25lKHJlc3VsdCwgdGV4dFN0YXR1cywganFYSFIsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICB9KS5mYWlsKGZ1bmN0aW9uIChqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuX29uRmFpbChqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24sIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICB9KS5hbHdheXMoZnVuY3Rpb24gKGpxWEhSb3JSZXN1bHQsIHRleHRTdGF0dXMsIGpxWEhSb3JFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5fb25BbHdheXMoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAganFYSFJvclJlc3VsdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0U3RhdHVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpxWEhSb3JFcnJvcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5fc2VuZGluZyAtPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5fYWN0aXZlIC09IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saW1pdENvbmN1cnJlbnRVcGxvYWRzICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMubGltaXRDb25jdXJyZW50VXBsb2FkcyA+IHRoYXQuX3NlbmRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTdGFydCB0aGUgbmV4dCBxdWV1ZWQgdXBsb2FkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoYXQgaGFzIG5vdCBiZWVuIGFib3J0ZWQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5leHRTbG90ID0gdGhhdC5fc2xvdHMuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAobmV4dFNsb3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoYXQuX2dldERlZmVycmVkU3RhdGUobmV4dFNsb3QpID09PSAncGVuZGluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRTbG90LnJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRTbG90ID0gdGhhdC5fc2xvdHMuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhhdC5fYWN0aXZlID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlIHN0b3AgY2FsbGJhY2sgaXMgdHJpZ2dlcmVkIHdoZW4gYWxsIHVwbG9hZHMgaGF2ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJlZW4gY29tcGxldGVkLCBlcXVpdmFsZW50IHRvIHRoZSBnbG9iYWwgYWpheFN0b3AgZXZlbnQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5fdHJpZ2dlcignc3RvcCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGpxWEhSO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLl9iZWZvcmVTZW5kKGUsIG9wdGlvbnMpO1xuICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5zZXF1ZW50aWFsVXBsb2FkcyB8fFxuICAgICAgICAgICAgICAgICAgICAodGhpcy5vcHRpb25zLmxpbWl0Q29uY3VycmVudFVwbG9hZHMgJiZcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vcHRpb25zLmxpbWl0Q29uY3VycmVudFVwbG9hZHMgPD0gdGhpcy5fc2VuZGluZykpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmxpbWl0Q29uY3VycmVudFVwbG9hZHMgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHNsb3QgPSAkLkRlZmVycmVkKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Nsb3RzLnB1c2goc2xvdCk7XG4gICAgICAgICAgICAgICAgICAgIHBpcGUgPSBzbG90LnBpcGUoc2VuZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2VxdWVuY2UgPSB0aGlzLl9zZXF1ZW5jZS5waXBlKHNlbmQsIHNlbmQpO1xuICAgICAgICAgICAgICAgICAgICBwaXBlID0gdGhpcy5fc2VxdWVuY2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFJldHVybiB0aGUgcGlwZWQgUHJvbWlzZSBvYmplY3QsIGVuaGFuY2VkIHdpdGggYW4gYWJvcnQgbWV0aG9kLFxuICAgICAgICAgICAgICAgIC8vIHdoaWNoIGlzIGRlbGVnYXRlZCB0byB0aGUganFYSFIgb2JqZWN0IG9mIHRoZSBjdXJyZW50IHVwbG9hZCxcbiAgICAgICAgICAgICAgICAvLyBhbmQganFYSFIgY2FsbGJhY2tzIG1hcHBlZCB0byB0aGUgZXF1aXZhbGVudCBQcm9taXNlIG1ldGhvZHM6XG4gICAgICAgICAgICAgICAgcGlwZS5hYm9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgYWJvcnRlZCA9IFt1bmRlZmluZWQsICdhYm9ydCcsICdhYm9ydCddO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWpxWEhSKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2xvdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNsb3QucmVqZWN0V2l0aChvcHRpb25zLmNvbnRleHQsIGFib3J0ZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbmQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ganFYSFIuYWJvcnQoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9lbmhhbmNlUHJvbWlzZShwaXBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzZW5kKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX29uQWRkOiBmdW5jdGlvbiAoZSwgZGF0YSkge1xuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzLFxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRydWUsXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCB0aGlzLm9wdGlvbnMsIGRhdGEpLFxuICAgICAgICAgICAgICAgIGZpbGVzID0gZGF0YS5maWxlcyxcbiAgICAgICAgICAgICAgICBmaWxlc0xlbmd0aCA9IGZpbGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBsaW1pdCA9IG9wdGlvbnMubGltaXRNdWx0aUZpbGVVcGxvYWRzLFxuICAgICAgICAgICAgICAgIGxpbWl0U2l6ZSA9IG9wdGlvbnMubGltaXRNdWx0aUZpbGVVcGxvYWRTaXplLFxuICAgICAgICAgICAgICAgIG92ZXJoZWFkID0gb3B0aW9ucy5saW1pdE11bHRpRmlsZVVwbG9hZFNpemVPdmVyaGVhZCxcbiAgICAgICAgICAgICAgICBiYXRjaFNpemUgPSAwLFxuICAgICAgICAgICAgICAgIHBhcmFtTmFtZSA9IHRoaXMuX2dldFBhcmFtTmFtZShvcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXJhbU5hbWVTZXQsXG4gICAgICAgICAgICAgICAgcGFyYW1OYW1lU2xpY2UsXG4gICAgICAgICAgICAgICAgZmlsZVNldCxcbiAgICAgICAgICAgICAgICBpLFxuICAgICAgICAgICAgICAgIGogPSAwO1xuICAgICAgICAgICAgaWYgKGxpbWl0U2l6ZSAmJiAoIWZpbGVzTGVuZ3RoIHx8IGZpbGVzWzBdLnNpemUgPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgICAgICAgICBsaW1pdFNpemUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIShvcHRpb25zLnNpbmdsZUZpbGVVcGxvYWRzIHx8IGxpbWl0IHx8IGxpbWl0U2l6ZSkgfHxcbiAgICAgICAgICAgICAgICAgICAgIXRoaXMuX2lzWEhSVXBsb2FkKG9wdGlvbnMpKSB7XG4gICAgICAgICAgICAgICAgZmlsZVNldCA9IFtmaWxlc107XG4gICAgICAgICAgICAgICAgcGFyYW1OYW1lU2V0ID0gW3BhcmFtTmFtZV07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCEob3B0aW9ucy5zaW5nbGVGaWxlVXBsb2FkcyB8fCBsaW1pdFNpemUpICYmIGxpbWl0KSB7XG4gICAgICAgICAgICAgICAgZmlsZVNldCA9IFtdO1xuICAgICAgICAgICAgICAgIHBhcmFtTmFtZVNldCA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBmaWxlc0xlbmd0aDsgaSArPSBsaW1pdCkge1xuICAgICAgICAgICAgICAgICAgICBmaWxlU2V0LnB1c2goZmlsZXMuc2xpY2UoaSwgaSArIGxpbWl0KSk7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtTmFtZVNsaWNlID0gcGFyYW1OYW1lLnNsaWNlKGksIGkgKyBsaW1pdCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcGFyYW1OYW1lU2xpY2UubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbU5hbWVTbGljZSA9IHBhcmFtTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBwYXJhbU5hbWVTZXQucHVzaChwYXJhbU5hbWVTbGljZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICghb3B0aW9ucy5zaW5nbGVGaWxlVXBsb2FkcyAmJiBsaW1pdFNpemUpIHtcbiAgICAgICAgICAgICAgICBmaWxlU2V0ID0gW107XG4gICAgICAgICAgICAgICAgcGFyYW1OYW1lU2V0ID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGZpbGVzTGVuZ3RoOyBpID0gaSArIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgYmF0Y2hTaXplICs9IGZpbGVzW2ldLnNpemUgKyBvdmVyaGVhZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgKyAxID09PSBmaWxlc0xlbmd0aCB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICgoYmF0Y2hTaXplICsgZmlsZXNbaSArIDFdLnNpemUgKyBvdmVyaGVhZCkgPiBsaW1pdFNpemUpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKGxpbWl0ICYmIGkgKyAxIC0gaiA+PSBsaW1pdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVTZXQucHVzaChmaWxlcy5zbGljZShqLCBpICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1OYW1lU2xpY2UgPSBwYXJhbU5hbWUuc2xpY2UoaiwgaSArIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFwYXJhbU5hbWVTbGljZS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJhbU5hbWVTbGljZSA9IHBhcmFtTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtTmFtZVNldC5wdXNoKHBhcmFtTmFtZVNsaWNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGogPSBpICsgMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhdGNoU2l6ZSA9IDA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBhcmFtTmFtZVNldCA9IHBhcmFtTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRhdGEub3JpZ2luYWxGaWxlcyA9IGZpbGVzO1xuICAgICAgICAgICAgJC5lYWNoKGZpbGVTZXQgfHwgZmlsZXMsIGZ1bmN0aW9uIChpbmRleCwgZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHZhciBuZXdEYXRhID0gJC5leHRlbmQoe30sIGRhdGEpO1xuICAgICAgICAgICAgICAgIG5ld0RhdGEuZmlsZXMgPSBmaWxlU2V0ID8gZWxlbWVudCA6IFtlbGVtZW50XTtcbiAgICAgICAgICAgICAgICBuZXdEYXRhLnBhcmFtTmFtZSA9IHBhcmFtTmFtZVNldFtpbmRleF07XG4gICAgICAgICAgICAgICAgdGhhdC5faW5pdFJlc3BvbnNlT2JqZWN0KG5ld0RhdGEpO1xuICAgICAgICAgICAgICAgIHRoYXQuX2luaXRQcm9ncmVzc09iamVjdChuZXdEYXRhKTtcbiAgICAgICAgICAgICAgICB0aGF0Ll9hZGRDb252ZW5pZW5jZU1ldGhvZHMoZSwgbmV3RGF0YSk7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdGhhdC5fdHJpZ2dlcihcbiAgICAgICAgICAgICAgICAgICAgJ2FkZCcsXG4gICAgICAgICAgICAgICAgICAgICQuRXZlbnQoJ2FkZCcsIHtkZWxlZ2F0ZWRFdmVudDogZX0pLFxuICAgICAgICAgICAgICAgICAgICBuZXdEYXRhXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9LFxuXG4gICAgICAgIF9yZXBsYWNlRmlsZUlucHV0OiBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICAgICAgICAgIHZhciBpbnB1dENsb25lID0gaW5wdXQuY2xvbmUodHJ1ZSk7XG4gICAgICAgICAgICAkKCc8Zm9ybT48L2Zvcm0+JykuYXBwZW5kKGlucHV0Q2xvbmUpWzBdLnJlc2V0KCk7XG4gICAgICAgICAgICAvLyBEZXRhY2hpbmcgYWxsb3dzIHRvIGluc2VydCB0aGUgZmlsZUlucHV0IG9uIGFub3RoZXIgZm9ybVxuICAgICAgICAgICAgLy8gd2l0aG91dCBsb29zaW5nIHRoZSBmaWxlIGlucHV0IHZhbHVlOlxuICAgICAgICAgICAgaW5wdXQuYWZ0ZXIoaW5wdXRDbG9uZSkuZGV0YWNoKCk7XG4gICAgICAgICAgICAvLyBBdm9pZCBtZW1vcnkgbGVha3Mgd2l0aCB0aGUgZGV0YWNoZWQgZmlsZSBpbnB1dDpcbiAgICAgICAgICAgICQuY2xlYW5EYXRhKGlucHV0LnVuYmluZCgncmVtb3ZlJykpO1xuICAgICAgICAgICAgLy8gUmVwbGFjZSB0aGUgb3JpZ2luYWwgZmlsZSBpbnB1dCBlbGVtZW50IGluIHRoZSBmaWxlSW5wdXRcbiAgICAgICAgICAgIC8vIGVsZW1lbnRzIHNldCB3aXRoIHRoZSBjbG9uZSwgd2hpY2ggaGFzIGJlZW4gY29waWVkIGluY2x1ZGluZ1xuICAgICAgICAgICAgLy8gZXZlbnQgaGFuZGxlcnM6XG4gICAgICAgICAgICB0aGlzLm9wdGlvbnMuZmlsZUlucHV0ID0gdGhpcy5vcHRpb25zLmZpbGVJbnB1dC5tYXAoZnVuY3Rpb24gKGksIGVsKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVsID09PSBpbnB1dFswXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5wdXRDbG9uZVswXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBJZiB0aGUgd2lkZ2V0IGhhcyBiZWVuIGluaXRpYWxpemVkIG9uIHRoZSBmaWxlIGlucHV0IGl0c2VsZixcbiAgICAgICAgICAgIC8vIG92ZXJyaWRlIHRoaXMuZWxlbWVudCB3aXRoIHRoZSBmaWxlIGlucHV0IGNsb25lOlxuICAgICAgICAgICAgaWYgKGlucHV0WzBdID09PSB0aGlzLmVsZW1lbnRbMF0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnQgPSBpbnB1dENsb25lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIF9oYW5kbGVGaWxlVHJlZUVudHJ5OiBmdW5jdGlvbiAoZW50cnksIHBhdGgpIHtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcyxcbiAgICAgICAgICAgICAgICBkZmQgPSAkLkRlZmVycmVkKCksXG4gICAgICAgICAgICAgICAgZXJyb3JIYW5kbGVyID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUgJiYgIWUuZW50cnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGUuZW50cnkgPSBlbnRyeTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBTaW5jZSAkLndoZW4gcmV0dXJucyBpbW1lZGlhdGVseSBpZiBvbmVcbiAgICAgICAgICAgICAgICAgICAgLy8gRGVmZXJyZWQgaXMgcmVqZWN0ZWQsIHdlIHVzZSByZXNvbHZlIGluc3RlYWQuXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgYWxsb3dzIHZhbGlkIGZpbGVzIGFuZCBpbnZhbGlkIGl0ZW1zXG4gICAgICAgICAgICAgICAgICAgIC8vIHRvIGJlIHJldHVybmVkIHRvZ2V0aGVyIGluIG9uZSBzZXQ6XG4gICAgICAgICAgICAgICAgICAgIGRmZC5yZXNvbHZlKFtlXSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkaXJSZWFkZXI7XG4gICAgICAgICAgICBwYXRoID0gcGF0aCB8fCAnJztcbiAgICAgICAgICAgIGlmIChlbnRyeS5pc0ZpbGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZW50cnkuX2ZpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gV29ya2Fyb3VuZCBmb3IgQ2hyb21lIGJ1ZyAjMTQ5NzM1XG4gICAgICAgICAgICAgICAgICAgIGVudHJ5Ll9maWxlLnJlbGF0aXZlUGF0aCA9IHBhdGg7XG4gICAgICAgICAgICAgICAgICAgIGRmZC5yZXNvbHZlKGVudHJ5Ll9maWxlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbnRyeS5maWxlKGZ1bmN0aW9uIChmaWxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlLnJlbGF0aXZlUGF0aCA9IHBhdGg7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZmQucmVzb2x2ZShmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgfSwgZXJyb3JIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KSB7XG4gICAgICAgICAgICAgICAgZGlyUmVhZGVyID0gZW50cnkuY3JlYXRlUmVhZGVyKCk7XG4gICAgICAgICAgICAgICAgZGlyUmVhZGVyLnJlYWRFbnRyaWVzKGZ1bmN0aW9uIChlbnRyaWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoYXQuX2hhbmRsZUZpbGVUcmVlRW50cmllcyhcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudHJpZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoICsgZW50cnkubmFtZSArICcvJ1xuICAgICAgICAgICAgICAgICAgICApLmRvbmUoZnVuY3Rpb24gKGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZmQucmVzb2x2ZShmaWxlcyk7XG4gICAgICAgICAgICAgICAgICAgIH0pLmZhaWwoZXJyb3JIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICB9LCBlcnJvckhhbmRsZXIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBSZXR1cm4gYW4gZW1weSBsaXN0IGZvciBmaWxlIHN5c3RlbSBpdGVtc1xuICAgICAgICAgICAgICAgIC8vIG90aGVyIHRoYW4gZmlsZXMgb3IgZGlyZWN0b3JpZXM6XG4gICAgICAgICAgICAgICAgZGZkLnJlc29sdmUoW10pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGRmZC5wcm9taXNlKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2hhbmRsZUZpbGVUcmVlRW50cmllczogZnVuY3Rpb24gKGVudHJpZXMsIHBhdGgpIHtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgICAgIHJldHVybiAkLndoZW4uYXBwbHkoXG4gICAgICAgICAgICAgICAgJCxcbiAgICAgICAgICAgICAgICAkLm1hcChlbnRyaWVzLCBmdW5jdGlvbiAoZW50cnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoYXQuX2hhbmRsZUZpbGVUcmVlRW50cnkoZW50cnksIHBhdGgpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApLnBpcGUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuY29uY2F0LmFwcGx5KFxuICAgICAgICAgICAgICAgICAgICBbXSxcbiAgICAgICAgICAgICAgICAgICAgYXJndW1lbnRzXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIF9nZXREcm9wcGVkRmlsZXM6IGZ1bmN0aW9uIChkYXRhVHJhbnNmZXIpIHtcbiAgICAgICAgICAgIGRhdGFUcmFuc2ZlciA9IGRhdGFUcmFuc2ZlciB8fCB7fTtcbiAgICAgICAgICAgIHZhciBpdGVtcyA9IGRhdGFUcmFuc2Zlci5pdGVtcztcbiAgICAgICAgICAgIGlmIChpdGVtcyAmJiBpdGVtcy5sZW5ndGggJiYgKGl0ZW1zWzBdLndlYmtpdEdldEFzRW50cnkgfHxcbiAgICAgICAgICAgICAgICAgICAgaXRlbXNbMF0uZ2V0QXNFbnRyeSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5faGFuZGxlRmlsZVRyZWVFbnRyaWVzKFxuICAgICAgICAgICAgICAgICAgICAkLm1hcChpdGVtcywgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlbnRyeTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpdGVtLndlYmtpdEdldEFzRW50cnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRyeSA9IGl0ZW0ud2Via2l0R2V0QXNFbnRyeSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBXb3JrYXJvdW5kIGZvciBDaHJvbWUgYnVnICMxNDk3MzU6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudHJ5Ll9maWxlID0gaXRlbS5nZXRBc0ZpbGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVudHJ5O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW0uZ2V0QXNFbnRyeSgpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gJC5EZWZlcnJlZCgpLnJlc29sdmUoXG4gICAgICAgICAgICAgICAgJC5tYWtlQXJyYXkoZGF0YVRyYW5zZmVyLmZpbGVzKVxuICAgICAgICAgICAgKS5wcm9taXNlKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2dldFNpbmdsZUZpbGVJbnB1dEZpbGVzOiBmdW5jdGlvbiAoZmlsZUlucHV0KSB7XG4gICAgICAgICAgICBmaWxlSW5wdXQgPSAkKGZpbGVJbnB1dCk7XG4gICAgICAgICAgICB2YXIgZW50cmllcyA9IGZpbGVJbnB1dC5wcm9wKCd3ZWJraXRFbnRyaWVzJykgfHxcbiAgICAgICAgICAgICAgICAgICAgZmlsZUlucHV0LnByb3AoJ2VudHJpZXMnKSxcbiAgICAgICAgICAgICAgICBmaWxlcyxcbiAgICAgICAgICAgICAgICB2YWx1ZTtcbiAgICAgICAgICAgIGlmIChlbnRyaWVzICYmIGVudHJpZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2hhbmRsZUZpbGVUcmVlRW50cmllcyhlbnRyaWVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZpbGVzID0gJC5tYWtlQXJyYXkoZmlsZUlucHV0LnByb3AoJ2ZpbGVzJykpO1xuICAgICAgICAgICAgaWYgKCFmaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGZpbGVJbnB1dC5wcm9wKCd2YWx1ZScpO1xuICAgICAgICAgICAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICQuRGVmZXJyZWQoKS5yZXNvbHZlKFtdKS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIElmIHRoZSBmaWxlcyBwcm9wZXJ0eSBpcyBub3QgYXZhaWxhYmxlLCB0aGUgYnJvd3NlciBkb2VzIG5vdFxuICAgICAgICAgICAgICAgIC8vIHN1cHBvcnQgdGhlIEZpbGUgQVBJIGFuZCB3ZSBhZGQgYSBwc2V1ZG8gRmlsZSBvYmplY3Qgd2l0aFxuICAgICAgICAgICAgICAgIC8vIHRoZSBpbnB1dCB2YWx1ZSBhcyBuYW1lIHdpdGggcGF0aCBpbmZvcm1hdGlvbiByZW1vdmVkOlxuICAgICAgICAgICAgICAgIGZpbGVzID0gW3tuYW1lOiB2YWx1ZS5yZXBsYWNlKC9eLipcXFxcLywgJycpfV07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpbGVzWzBdLm5hbWUgPT09IHVuZGVmaW5lZCAmJiBmaWxlc1swXS5maWxlTmFtZSkge1xuICAgICAgICAgICAgICAgIC8vIEZpbGUgbm9ybWFsaXphdGlvbiBmb3IgU2FmYXJpIDQgYW5kIEZpcmVmb3ggMzpcbiAgICAgICAgICAgICAgICAkLmVhY2goZmlsZXMsIGZ1bmN0aW9uIChpbmRleCwgZmlsZSkge1xuICAgICAgICAgICAgICAgICAgICBmaWxlLm5hbWUgPSBmaWxlLmZpbGVOYW1lO1xuICAgICAgICAgICAgICAgICAgICBmaWxlLnNpemUgPSBmaWxlLmZpbGVTaXplO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICQuRGVmZXJyZWQoKS5yZXNvbHZlKGZpbGVzKS5wcm9taXNlKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2dldEZpbGVJbnB1dEZpbGVzOiBmdW5jdGlvbiAoZmlsZUlucHV0KSB7XG4gICAgICAgICAgICBpZiAoIShmaWxlSW5wdXQgaW5zdGFuY2VvZiAkKSB8fCBmaWxlSW5wdXQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNpbmdsZUZpbGVJbnB1dEZpbGVzKGZpbGVJbnB1dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gJC53aGVuLmFwcGx5KFxuICAgICAgICAgICAgICAgICQsXG4gICAgICAgICAgICAgICAgJC5tYXAoZmlsZUlucHV0LCB0aGlzLl9nZXRTaW5nbGVGaWxlSW5wdXRGaWxlcylcbiAgICAgICAgICAgICkucGlwZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkoXG4gICAgICAgICAgICAgICAgICAgIFtdLFxuICAgICAgICAgICAgICAgICAgICBhcmd1bWVudHNcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX29uQ2hhbmdlOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzLFxuICAgICAgICAgICAgICAgIGRhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbGVJbnB1dDogJChlLnRhcmdldCksXG4gICAgICAgICAgICAgICAgICAgIGZvcm06ICQoZS50YXJnZXQuZm9ybSlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5fZ2V0RmlsZUlucHV0RmlsZXMoZGF0YS5maWxlSW5wdXQpLmFsd2F5cyhmdW5jdGlvbiAoZmlsZXMpIHtcbiAgICAgICAgICAgICAgICBkYXRhLmZpbGVzID0gZmlsZXM7XG4gICAgICAgICAgICAgICAgaWYgKHRoYXQub3B0aW9ucy5yZXBsYWNlRmlsZUlucHV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoYXQuX3JlcGxhY2VGaWxlSW5wdXQoZGF0YS5maWxlSW5wdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGhhdC5fdHJpZ2dlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICdjaGFuZ2UnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJC5FdmVudCgnY2hhbmdlJywge2RlbGVnYXRlZEV2ZW50OiBlfSksXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhXG4gICAgICAgICAgICAgICAgICAgICkgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoYXQuX29uQWRkKGUsIGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIF9vblBhc3RlOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgdmFyIGl0ZW1zID0gZS5vcmlnaW5hbEV2ZW50ICYmIGUub3JpZ2luYWxFdmVudC5jbGlwYm9hcmREYXRhICYmXG4gICAgICAgICAgICAgICAgICAgIGUub3JpZ2luYWxFdmVudC5jbGlwYm9hcmREYXRhLml0ZW1zLFxuICAgICAgICAgICAgICAgIGRhdGEgPSB7ZmlsZXM6IFtdfTtcbiAgICAgICAgICAgIGlmIChpdGVtcyAmJiBpdGVtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAkLmVhY2goaXRlbXMsIGZ1bmN0aW9uIChpbmRleCwgaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmlsZSA9IGl0ZW0uZ2V0QXNGaWxlICYmIGl0ZW0uZ2V0QXNGaWxlKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmZpbGVzLnB1c2goZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fdHJpZ2dlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICdwYXN0ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAkLkV2ZW50KCdwYXN0ZScsIHtkZWxlZ2F0ZWRFdmVudDogZX0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVxuICAgICAgICAgICAgICAgICAgICApICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbkFkZChlLCBkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgX29uRHJvcDogZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGUuZGF0YVRyYW5zZmVyID0gZS5vcmlnaW5hbEV2ZW50ICYmIGUub3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXI7XG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXMsXG4gICAgICAgICAgICAgICAgZGF0YVRyYW5zZmVyID0gZS5kYXRhVHJhbnNmZXIsXG4gICAgICAgICAgICAgICAgZGF0YSA9IHt9O1xuICAgICAgICAgICAgaWYgKGRhdGFUcmFuc2ZlciAmJiBkYXRhVHJhbnNmZXIuZmlsZXMgJiYgZGF0YVRyYW5zZmVyLmZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nZXREcm9wcGVkRmlsZXMoZGF0YVRyYW5zZmVyKS5hbHdheXMoZnVuY3Rpb24gKGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEuZmlsZXMgPSBmaWxlcztcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoYXQuX3RyaWdnZXIoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2Ryb3AnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQuRXZlbnQoJ2Ryb3AnLCB7ZGVsZWdhdGVkRXZlbnQ6IGV9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICApICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5fb25BZGQoZSwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBfb25EcmFnT3ZlcjogZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGUuZGF0YVRyYW5zZmVyID0gZS5vcmlnaW5hbEV2ZW50ICYmIGUub3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXI7XG4gICAgICAgICAgICB2YXIgZGF0YVRyYW5zZmVyID0gZS5kYXRhVHJhbnNmZXI7XG4gICAgICAgICAgICBpZiAoZGF0YVRyYW5zZmVyICYmICQuaW5BcnJheSgnRmlsZXMnLCBkYXRhVHJhbnNmZXIudHlwZXMpICE9PSAtMSAmJlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90cmlnZ2VyKFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2RyYWdvdmVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICQuRXZlbnQoJ2RyYWdvdmVyJywge2RlbGVnYXRlZEV2ZW50OiBlfSlcbiAgICAgICAgICAgICAgICAgICAgKSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2luaXRFdmVudEhhbmRsZXJzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5faXNYSFJVcGxvYWQodGhpcy5vcHRpb25zKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX29uKHRoaXMub3B0aW9ucy5kcm9wWm9uZSwge1xuICAgICAgICAgICAgICAgICAgICBkcmFnb3ZlcjogdGhpcy5fb25EcmFnT3ZlcixcbiAgICAgICAgICAgICAgICAgICAgZHJvcDogdGhpcy5fb25Ecm9wXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fb24odGhpcy5vcHRpb25zLnBhc3RlWm9uZSwge1xuICAgICAgICAgICAgICAgICAgICBwYXN0ZTogdGhpcy5fb25QYXN0ZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCQuc3VwcG9ydC5maWxlSW5wdXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vbih0aGlzLm9wdGlvbnMuZmlsZUlucHV0LCB7XG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZTogdGhpcy5fb25DaGFuZ2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBfZGVzdHJveUV2ZW50SGFuZGxlcnM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX29mZih0aGlzLm9wdGlvbnMuZHJvcFpvbmUsICdkcmFnb3ZlciBkcm9wJyk7XG4gICAgICAgICAgICB0aGlzLl9vZmYodGhpcy5vcHRpb25zLnBhc3RlWm9uZSwgJ3Bhc3RlJyk7XG4gICAgICAgICAgICB0aGlzLl9vZmYodGhpcy5vcHRpb25zLmZpbGVJbnB1dCwgJ2NoYW5nZScpO1xuICAgICAgICB9LFxuXG4gICAgICAgIF9zZXRPcHRpb246IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgICAgICB2YXIgcmVpbml0ID0gJC5pbkFycmF5KGtleSwgdGhpcy5fc3BlY2lhbE9wdGlvbnMpICE9PSAtMTtcbiAgICAgICAgICAgIGlmIChyZWluaXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXN0cm95RXZlbnRIYW5kbGVycygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoa2V5LCB2YWx1ZSk7XG4gICAgICAgICAgICBpZiAocmVpbml0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5pdFNwZWNpYWxPcHRpb25zKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5pdEV2ZW50SGFuZGxlcnMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBfaW5pdFNwZWNpYWxPcHRpb25zOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmZpbGVJbnB1dCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5maWxlSW5wdXQgPSB0aGlzLmVsZW1lbnQuaXMoJ2lucHV0W3R5cGU9XCJmaWxlXCJdJykgP1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbGVtZW50IDogdGhpcy5lbGVtZW50LmZpbmQoJ2lucHV0W3R5cGU9XCJmaWxlXCJdJyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCEob3B0aW9ucy5maWxlSW5wdXQgaW5zdGFuY2VvZiAkKSkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMuZmlsZUlucHV0ID0gJChvcHRpb25zLmZpbGVJbnB1dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIShvcHRpb25zLmRyb3Bab25lIGluc3RhbmNlb2YgJCkpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLmRyb3Bab25lID0gJChvcHRpb25zLmRyb3Bab25lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKG9wdGlvbnMucGFzdGVab25lIGluc3RhbmNlb2YgJCkpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnBhc3RlWm9uZSA9ICQob3B0aW9ucy5wYXN0ZVpvbmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIF9nZXRSZWdFeHA6IGZ1bmN0aW9uIChzdHIpIHtcbiAgICAgICAgICAgIHZhciBwYXJ0cyA9IHN0ci5zcGxpdCgnLycpLFxuICAgICAgICAgICAgICAgIG1vZGlmaWVycyA9IHBhcnRzLnBvcCgpO1xuICAgICAgICAgICAgcGFydHMuc2hpZnQoKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUmVnRXhwKHBhcnRzLmpvaW4oJy8nKSwgbW9kaWZpZXJzKTtcbiAgICAgICAgfSxcblxuICAgICAgICBfaXNSZWdFeHBPcHRpb246IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4ga2V5ICE9PSAndXJsJyAmJiAkLnR5cGUodmFsdWUpID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgICAgICAgIC9eXFwvLipcXC9baWdtXXswLDN9JC8udGVzdCh2YWx1ZSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2luaXREYXRhQXR0cmlidXRlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzLFxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnMsXG4gICAgICAgICAgICAgICAgY2xvbmUgPSAkKHRoaXMuZWxlbWVudFswXS5jbG9uZU5vZGUoZmFsc2UpKTtcbiAgICAgICAgICAgIC8vIEluaXRpYWxpemUgb3B0aW9ucyBzZXQgdmlhIEhUTUw1IGRhdGEtYXR0cmlidXRlczpcbiAgICAgICAgICAgICQuZWFjaChcbiAgICAgICAgICAgICAgICBjbG9uZS5kYXRhKCksXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGFBdHRyaWJ1dGVOYW1lID0gJ2RhdGEtJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBDb252ZXJ0IGNhbWVsQ2FzZSB0byBoeXBoZW4tYXRlZCBrZXk6XG4gICAgICAgICAgICAgICAgICAgICAgICBrZXkucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxLSQyJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNsb25lLmF0dHIoZGF0YUF0dHJpYnV0ZU5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhhdC5faXNSZWdFeHBPcHRpb24oa2V5LCB2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHRoYXQuX2dldFJlZ0V4cCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2NyZWF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5faW5pdERhdGFBdHRyaWJ1dGVzKCk7XG4gICAgICAgICAgICB0aGlzLl9pbml0U3BlY2lhbE9wdGlvbnMoKTtcbiAgICAgICAgICAgIHRoaXMuX3Nsb3RzID0gW107XG4gICAgICAgICAgICB0aGlzLl9zZXF1ZW5jZSA9IHRoaXMuX2dldFhIUlByb21pc2UodHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLl9zZW5kaW5nID0gdGhpcy5fYWN0aXZlID0gMDtcbiAgICAgICAgICAgIHRoaXMuX2luaXRQcm9ncmVzc09iamVjdCh0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX2luaXRFdmVudEhhbmRsZXJzKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gVGhpcyBtZXRob2QgaXMgZXhwb3NlZCB0byB0aGUgd2lkZ2V0IEFQSSBhbmQgYWxsb3dzIHRvIHF1ZXJ5XG4gICAgICAgIC8vIHRoZSBudW1iZXIgb2YgYWN0aXZlIHVwbG9hZHM6XG4gICAgICAgIGFjdGl2ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBUaGlzIG1ldGhvZCBpcyBleHBvc2VkIHRvIHRoZSB3aWRnZXQgQVBJIGFuZCBhbGxvd3MgdG8gcXVlcnlcbiAgICAgICAgLy8gdGhlIHdpZGdldCB1cGxvYWQgcHJvZ3Jlc3MuXG4gICAgICAgIC8vIEl0IHJldHVybnMgYW4gb2JqZWN0IHdpdGggbG9hZGVkLCB0b3RhbCBhbmQgYml0cmF0ZSBwcm9wZXJ0aWVzXG4gICAgICAgIC8vIGZvciB0aGUgcnVubmluZyB1cGxvYWRzOlxuICAgICAgICBwcm9ncmVzczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3Byb2dyZXNzO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIFRoaXMgbWV0aG9kIGlzIGV4cG9zZWQgdG8gdGhlIHdpZGdldCBBUEkgYW5kIGFsbG93cyBhZGRpbmcgZmlsZXNcbiAgICAgICAgLy8gdXNpbmcgdGhlIGZpbGV1cGxvYWQgQVBJLiBUaGUgZGF0YSBwYXJhbWV0ZXIgYWNjZXB0cyBhbiBvYmplY3Qgd2hpY2hcbiAgICAgICAgLy8gbXVzdCBoYXZlIGEgZmlsZXMgcHJvcGVydHkgYW5kIGNhbiBjb250YWluIGFkZGl0aW9uYWwgb3B0aW9uczpcbiAgICAgICAgLy8gLmZpbGV1cGxvYWQoJ2FkZCcsIHtmaWxlczogZmlsZXNMaXN0fSk7XG4gICAgICAgIGFkZDogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgICAgIGlmICghZGF0YSB8fCB0aGlzLm9wdGlvbnMuZGlzYWJsZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF0YS5maWxlSW5wdXQgJiYgIWRhdGEuZmlsZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9nZXRGaWxlSW5wdXRGaWxlcyhkYXRhLmZpbGVJbnB1dCkuYWx3YXlzKGZ1bmN0aW9uIChmaWxlcykge1xuICAgICAgICAgICAgICAgICAgICBkYXRhLmZpbGVzID0gZmlsZXM7XG4gICAgICAgICAgICAgICAgICAgIHRoYXQuX29uQWRkKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkYXRhLmZpbGVzID0gJC5tYWtlQXJyYXkoZGF0YS5maWxlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fb25BZGQobnVsbCwgZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gVGhpcyBtZXRob2QgaXMgZXhwb3NlZCB0byB0aGUgd2lkZ2V0IEFQSSBhbmQgYWxsb3dzIHNlbmRpbmcgZmlsZXNcbiAgICAgICAgLy8gdXNpbmcgdGhlIGZpbGV1cGxvYWQgQVBJLiBUaGUgZGF0YSBwYXJhbWV0ZXIgYWNjZXB0cyBhbiBvYmplY3Qgd2hpY2hcbiAgICAgICAgLy8gbXVzdCBoYXZlIGEgZmlsZXMgb3IgZmlsZUlucHV0IHByb3BlcnR5IGFuZCBjYW4gY29udGFpbiBhZGRpdGlvbmFsIG9wdGlvbnM6XG4gICAgICAgIC8vIC5maWxldXBsb2FkKCdzZW5kJywge2ZpbGVzOiBmaWxlc0xpc3R9KTtcbiAgICAgICAgLy8gVGhlIG1ldGhvZCByZXR1cm5zIGEgUHJvbWlzZSBvYmplY3QgZm9yIHRoZSBmaWxlIHVwbG9hZCBjYWxsLlxuICAgICAgICBzZW5kOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgaWYgKGRhdGEgJiYgIXRoaXMub3B0aW9ucy5kaXNhYmxlZCkge1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLmZpbGVJbnB1dCAmJiAhZGF0YS5maWxlcykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZmQgPSAkLkRlZmVycmVkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlID0gZGZkLnByb21pc2UoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGpxWEhSLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWJvcnRlZDtcbiAgICAgICAgICAgICAgICAgICAgcHJvbWlzZS5hYm9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFib3J0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGpxWEhSKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGpxWEhSLmFib3J0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBkZmQucmVqZWN0KG51bGwsICdhYm9ydCcsICdhYm9ydCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dldEZpbGVJbnB1dEZpbGVzKGRhdGEuZmlsZUlucHV0KS5hbHdheXMoXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAoZmlsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYWJvcnRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZmlsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRmZC5yZWplY3QoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmZpbGVzID0gZmlsZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAganFYSFIgPSB0aGF0Ll9vblNlbmQobnVsbCwgZGF0YSkudGhlbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKHJlc3VsdCwgdGV4dFN0YXR1cywganFYSFIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRmZC5yZXNvbHZlKHJlc3VsdCwgdGV4dFN0YXR1cywganFYSFIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAoanFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZmQucmVqZWN0KGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZW5oYW5jZVByb21pc2UocHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRhdGEuZmlsZXMgPSAkLm1ha2VBcnJheShkYXRhLmZpbGVzKTtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5maWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX29uU2VuZChudWxsLCBkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZ2V0WEhSUHJvbWlzZShmYWxzZSwgZGF0YSAmJiBkYXRhLmNvbnRleHQpO1xuICAgICAgICB9XG5cbiAgICB9KTtcblxufSkpO1xuIl0sImZpbGUiOiJqcXVlcnkuZmlsZXVwbG9hZC5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9