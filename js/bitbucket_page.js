/* eslint-env amd */
/* globals bitbucket, aui, WRM, AJS, template */
(function() {
  // bitbucket page must have require function
	if (typeof window.define === 'undefined' || typeof window.require === 'undefined' || typeof window.bitbucket === 'undefined') {
    return;
  }
  
	// workaround to fix missing firefox onMessageExternal
	if (!window.chrome || !window.chrome.runtime || typeof(window.chrome.runtime.sendMessage) !== 'function') {
    window.communication = {
      runtime : {
        sendMessage(extId, msg, callback) {
					const randEventId = Math.floor((Math.random() * 1000) + 1);
					msg.eventId = randEventId;
					msg.extId = extId;
					window.postMessage(msg, '*');
					if (callback) {
            window.addEventListener('message', (eventArgs) => {
              if (eventArgs.data.identifier === randEventId) {
                callback(eventArgs.data.backgroundResult);
              }
						});
					}
				}
			}
		};
	} else {
    window.communication = {
      runtime: {
        sendMessage: window.chrome.runtime.sendMessage
			}
		};
	}
  
	define('bitbucket-plugin/url', () => {
    const getSiteBaseURl = () => {
      return `${location.protocol}//${location.host}`;
		}
    
		const buildSlug = (pageState) => {
      if (pageState.links && pageState.links.self) {
        return pageState.links.self[0].href.replace(getSiteBaseURl(), '');
			}
			return '';
		}
    
		return {
      getSiteBaseURl,
			buildSlug
		}
	});
  
	define('bitbucket-plugin/pullrequest-create-page', [
		'jquery',
		'lodash',
		'bitbucket/util/events',
		'bitbucket/util/state'
	], (
		jQuery,
		_,
		events,
		pageState
  ) => {
    'use strict';
    const listId = "ul_reviewers_list";
    const reviewersDataKey = "reviewers";
    const buttonIconId = "img_group_icon";
    
    const getGroupIcon = () => {
      return `<img id="${buttonIconId}" style="width:16px; height:16px;" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAYAAADE6YVjAAABiElEQVRIS72V/zEEQRCFv4sAESADIkAEZIAMXASIABEgAyJABC4DRIAIqE/NXu3Oza/aOtf/bO1uT7/u1697JqzAJivAoAZyBBwCWyGZGXAJfIX3HWAN+ADecwmXQO6A48RBg/nvBhB0M/g8hAT8NrAcyAlwW6Gyq+gq8tsN4PPPOZBnYK8CYkUG/Iz8HgFproLIuVzXzCR/IqcXYL8FJD5Y6ulokBa6VJQZv0UZKIizlkpUitItmdxfA0//2RP7tp1o/D2gOquNb6HLBkvLay/ed6BwMCs5CTvJ/cMp2pSvIP2BXajCg6WJL/XFflwkEtnorZwqXTqUqjkIvMdrJ5l0bUHm5iU1hCbmTpvG1YwFkRbpzK0eweyPAsr2xNXughysh173PXwa3m2+kk2tIedoGleiszzngscqE8ysFYLP1ADPQWyymfscY86Flbl9z6MAMyuRGmdifUz03hk3gLOjtLub9O+3ILkbcAzmwl3SgbTeHS2gxlJ5A7MSy1umLcSrzclSwH8BMXpPGYwvvtgAAAAASUVORK5CYII="/>`;
    }
    
    const getGroupIconLoader = () => {
      return `<img id="${buttonIconId}" src="data:image/gif;base64,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"/>`;
    }

    const searchUsersAsync = (term) => {
      const deferred = jQuery.Deferred();
      
			const searchParams = { avatarSize: 32, permission: "LICENSED_USER", start: 0, filter: term };
      
			jQuery.get('/rest/api/latest/users', searchParams)
        .done((data) => {
          if (data.values.length > 0) {
            const rawd = data.values[0];
            const select2Data = {
              id: rawd.name,
              text: rawd.displayName || rawd.name,
              item: rawd
            };   
            deferred.resolve(select2Data);
          }
            deferred.resolve(null);
        })
				.fail(() => {
					deferred.resolve(null);
				});
      return deferred.promise();
    };
      
    const attachDropdownClickEvent = (dropdown) => {
      jQuery(dropdown).find(`#${listId}`).find('li').click(function () {
        const $element = jQuery(this);
        const reviewers = $element.data(reviewersDataKey);
        const differedList = [];
        const select2DataArray = [];
        
        jQuery(`#${buttonIconId}`).replaceWith(getGroupIconLoader());
        
        reviewers.forEach((reviewer) => {
          const searchDeferred = searchUsersAsync(reviewer);
          differedList.push(searchDeferred);
          searchDeferred.done((select2Data) => {
            if (select2Data && pageState.getCurrentUser().id !== select2Data.item.id) {
              select2DataArray.push(select2Data);
            }
          });
        });
        
        jQuery.when.apply(jQuery, differedList).done(() => {
          jQuery(`#${buttonIconId}`).replaceWith(getGroupIcon());
        
          const allUsers = jQuery('#reviewers').select2('data');
          jQuery('#reviewers').select2('data', null).trigger('change');
          jQuery('#reviewers').select2('val', null).trigger('change');
          allUsers.forEach((item) => {
            const e = new jQuery.Event("change");
            e.removed = item;
            jQuery('#reviewers').trigger(e);
          });
          
          jQuery.merge(select2DataArray, allUsers);
          
          select2DataArray.forEach((select2Data) => {
            const e = new jQuery.Event('change');
            e.added = select2Data;
            jQuery('#reviewers').trigger(e);
          });
          
          jQuery('#reviewers').select2('data', select2DataArray);
        });
			});
		}
    
		const injectReviewersDropdown = (jsonGroups) => {
			const $reviewersInput = jQuery('#s2id_reviewers');
			if ($reviewersInput.length == 0) {
        return;
			}
      
			const dropdownHTML = ([
        '<a href="#reviewers_list" aria-owns="reviewers_list" aria-haspopup="true" class="aui-button aui-style-default aui-dropdown2-trigger" style="margin-left: 10px; display: inline-block; top: -10px;">',
				getGroupIcon(),
				'</a>',
				'<div id="reviewers_list" class="aui-style-default aui-dropdown2">',
				`<ul class="aui-list-truncate" id="${listId}">`,
				'</ul>',
				'</div>',
			]).join("\n");
      
			// jquery instance
			const $dropdown = jQuery(dropdownHTML);
      
			// add groups list
			jsonGroups.groups.forEach((group) => {
        const linkText = `${group.groupName  } (${  group.reviewers.length  } reviewers)`;
				const $a = jQuery('<a href="Javascript:void(0)"></a>').text(linkText);
				const $li = jQuery('<li></li>').append($a).data(reviewersDataKey, group.reviewers);
				$dropdown.find(`#${  listId}`).append($li);
			});
      
			// click event
			attachDropdownClickEvent($dropdown);
      
			// fix z-index bug
			$dropdown.on({
        "aui-dropdown2-show"() {
          window.setTimeout(() => {
            jQuery("#reviewers_list").css("z-index", "4000");
					}, 50);
				}
			});
      
			// append to the page
			$reviewersInput.after($dropdown);
		}
    
		return {
			injectReviewersDropdown
		};
	});

	const extensionInit = (jQuery) => {
		let pageState;
		const loadRequirement = jQuery.Deferred();
		const loadAuiFlag = jQuery.Deferred();

		try {
			WRM.require("wr!" + 'com.atlassian.auiplugin:aui-flag').then(() => {
				loadAuiFlag.resolve();
			});
		}
		catch (_) {
			// optional
			loadAuiFlag.resolve();
		}

		try {
			pageState = require('bitbucket/util/state');
			loadRequirement.resolve();
		}
		catch (_) {
			try {
				WRM.require("wr!" + 'com.atlassian.bitbucket.server.bitbucket-web-api:state').then(() => {
					pageState = require('bitbucket/util/state');
					loadRequirement.resolve();
				});
			}
			catch (_) {
				loadRequirement.reject();
			}
		}

		jQuery.when(loadAuiFlag).done(() => {
			const user = pageState.getCurrentUser();
			const project = pageState.getProject();
			const repository = pageState.getRepository();
			const pullRequest = pageState.getPullRequest();

			if (user) {
				require([], () => {
					if (!project) {
						// main page
					}
					else if (project && !repository) {
						// project page
					}
					else if (project && repository && !pullRequest) {
						// repository page

						// PR Reviewers groups (create page)
						require(['bitbucket-plugin/pullrequest-create-page'], (prCreateUtil) => {
							if (window.featuresData.reviewersgroup == 1) {
								prCreateUtil.injectReviewersDropdown(jsonGroups);
              }
						});

					} else if (pullRequest) {
						require(['bitbucket-plugin/pullrequest-create-page'], (prCreateUtil) => {
							// Reviewers groups (edit page)
							AJS.bind("show.dialog", inject);
							AJS.dialog2.on("show", inject);

							function inject() {
								if (window.featuresData.reviewersgroup == 1) {
									prCreateUtil.injectReviewersDropdown(jsonGroups);
                }
							}
						});
					}
				});
			}
		});
  };
  
  require(['jquery'], extensionInit);
}());
