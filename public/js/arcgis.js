require([
    "esri/Map",
    "esri/PopupTemplate",
    "esri/views/MapView",
    "esri/Graphic",
    "esri/geometry/Point",
    "esri/symbols/SimpleMarkerSymbol",
    "esri/tasks/Locator",
    "esri/widgets/Search",
    "esri/geometry/support/webMercatorUtils",
    "dojo/domReady!"
], function(Map, PopupTemplate, MapView, Graphic, Point, SimpleMarkerSymbol,
            Locator, Search, webMercatorUtils) {
// Create the Map
var map = new Map({
    basemap: "streets-navigation-vector"
})
// Create the MapView
var view = new MapView({
    container: "arcgis-map",
    map: map,
    center: [-116.3031, 43.6088],
    zoom: 1
})
// Set up a locator task using the world geocoding service
var locatorTask = new Locator({
    url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
})
// Setup search box
var searchWidget = new Search({
    view: view,
    })
searchWidget.startup()
// Add the search widget to the top left corner of the view
view.ui.add(searchWidget, {
    position: "top-left",
    index: 0
})
/*******************************************************************
 * This click event sets generic content on the popup not tied to
 * a layer, graphic, or popupTemplate. The location of the point is
 * used as input to a reverse geocode method and the resulting
 * address is printed to the popup content.
 *******************************************************************/
view.on("click", function(evt) {
    // Get the coordinates of the click on the view
    var x = evt.mapPoint.longitude
    var y = evt.mapPoint.latitude
    var lon = Math.round(evt.mapPoint.longitude * 1000) / 1000  // x
    var lat = Math.round(evt.mapPoint.latitude * 1000) / 1000   // y

    view.popup.open({
        // Set the popup's title to the coordinates of the location
        title: "Resolving address...",
        location: evt.mapPoint, // Set the location of the popup to the clicked location
        content: "Reverse geocode: [" + lon + ", " + lat + "]" + 
                '<a href="@' + x + ':' + y + '">I can donate blood here</a>'
})
// Display the popup
// Execute a reverse geocode using the clicked location
locatorTask.locationToAddress(evt.mapPoint).then(function(
    response) {
    // If an address is successfully found, print it to the popup's content
    var address = response.address.Match_addr
    view.popup.title = address
}).otherwise(function(err) {
    // If the promise fails and no result is found, print a generic message
    // to the popup's content
    view.popup.title = "No address was found for this location<br>" + 
                       "However you can still donate on this location"
})})
// Create a symbol for drawing the point
var markerSymbol = new SimpleMarkerSymbol({
    color: [226, 119, 40],
    outline: { // autocasts as new SimpleLineSymbol()
        color: [255, 255, 255],
        width: 2
    }
});
var point_graphics = {}
var pointExists = function(id) {
    return point_graphics[id] !== undefined
}
var createPoint = function(lon, lat, id) {
    if (!pointExists(id)) {
        var point =  new Point({
                longitude: lon,
                latitude: lat
            })
        var pointGraphic = new Graphic({
            geometry: point,
            symbol: markerSymbol
        });
        view.graphics.add(pointGraphic)

    }
}
var updatePoint = function(lon, lat, id) {
    view.graphics.remove(point_graphics[id])
    createPoint(lat, lon, id)
}
var P1 = 0
var P2 = 0
// Extract boundaries to be used with socket.io
setInterval(function(){
    var v = view.extent
    P1 = webMercatorUtils.xyToLngLat(v.xmin, v.ymin)
    P2 = webMercatorUtils.xyToLngLat(v.xmax, v.ymax)
}, 100)
var server = io()
var old_p1 = 0
var old_p2 = 0
// Coordinate boundaries are set undefined at the load stage of the map
// So in order to avoid errors, first we set a listener whether map has
// Loaded, after starting to get defined values from P1 and P2, we start 
// to listen every 1500 ms for changes on P1 and P2, if there is a change 
// we lazy load pinpoints in that area
var load = function() {
  if (P1 !== undefined && P2 !== undefined) {
    // Map has been loaded (initialized)
    // Setup the listener for navigation changes
    setInterval(function(){
      if (old_p1[0] != P1[0] || old_p1[1] != P1[1] || 
          old_p2[0] != P2[0] || old_p2[1] != P2[1]) {
          // Update old values with new ones
          old_p1 = P1
          old_p2 = P2
          // Lazy load
          server.emit("2", { x1: P1[0], y1: P1[1], x2: P2[0], y2: P2[1]})
      }
    }, 1500)
  } else {
    setTimeout(load, 100)
  }
}
setTimeout(load, 100)
// Server has sent pinpoints
server.on("2", function(msg) {
  // Load pinpoints
  for (var i = msg.length - 1; i != -1; i-=1) {
    createPoint(msg[i].geo_x, msg[i].geo_y, msg[i]._id)
  }
})
//w00t
})