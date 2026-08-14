/**
 * Shop storefront: the Loyalty Program page is a dead Smile.io shell.
 * Send customers to the live rewards page on southlandorganics.com.
 */
(function () {
  var DEST = 'https://southlandorganics.com/rewards/'
  var RE = /\/pages\/southland-organics-rewards\/?$/
  try {
    if (RE.test(location.pathname)) {
      location.replace(DEST + location.search + location.hash)
      return
    }
    function rewrite() {
      var links = document.querySelectorAll('a[href*="southland-organics-rewards"]')
      for (var i = 0; i < links.length; i++) links[i].setAttribute('href', DEST)
    }
    rewrite()
    document.addEventListener('DOMContentLoaded', rewrite)
  } catch (e) {}
})()
