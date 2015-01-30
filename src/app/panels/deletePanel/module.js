/** @scratch /panels/5
 *
 * include::panels/deletePanel.asciidoc[]
 */

/** @scratch /panels/deletePanel/0
 *
 * == deletePanel
 * Status: *Stable*
 *
 * The delete  panel displays the number of hits for each of the queries on the dashboard and it allows to delete all matching records.
 *
 */
define([
  'angular',
  'app',
  'lodash',
  'jquery',
  'kbn',

  'jquery.flot',
  'jquery.flot.pie'
], function (angular, app, _, $, kbn) {
  'use strict';

  var module = angular.module('kibana.panels.deletePanel', []);
  app.useModule(module);


  module.directive('ngConfirmClick', [
          function(){
              return {
                  link: function (scope, element, attr) {
                      var msg = attr.ngConfirmClick || "Are you sure?";
                      var clickAction = attr.confirmedClick;
                      element.bind('click',function (event) {
                          if ( window.confirm(msg) ) {
                              scope.$eval(clickAction)
                          }
                      });
                  }
              };
      }])

  module.controller('deletePanel', function($scope, querySrv, dashboard, filterSrv) {
    $scope.panelMeta = {
      editorTabs : [
        {title:'Queries', src:'app/partials/querySelect.html'}
      ],
      status  : "Stable",
      description : "The delete  panel displays the number of hits for each of the queries on the dashboard and it allows to delete all matching records."
    };

    // Set and populate defaults
    var _d = {
      style   : { "font-size": '10pt'},
      /** @scratch /panels/hits/3
       *
       * === Parameters
       *
       * arrangement:: The arrangement of the legend. horizontal or vertical
       */
      arrangement : 'horizontal',

      /** @scratch /panels/hits/5
       *
       * ==== Queries
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      },
    };
    _.defaults($scope.panel,_d);

    $scope.init = function () {
      $scope.hits = 0;

      $scope.$on('refresh',function(){
        $scope.get_data();
      });
      $scope.get_data();

    };

    $scope.delete_data = function(query) {
      var _q = $scope.ejs.FilteredQuery(
          querySrv.toEjsObj(querySrv.getQueryObjs([query.id])[0]),
          filterSrv.getBoolFilter(filterSrv.ids()));
      var request = $scope.ejs.Request();
      request = request.query(_q);
      $scope.ejs.doDeleteByQuery(dashboard.indices, request).then(
        function (res){
          dashboard.refresh();
        });
      
    }

    $scope.get_data = function(segment,query_id) {
      delete $scope.panel.error;
      $scope.panelMeta.loading = true;

      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }

      var _segment = _.isUndefined(segment) ? 0 : segment;
      var request = $scope.ejs.Request();

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      var queries = querySrv.getQueryObjs($scope.panel.queries.ids);
        
      // Build the question part of the query
      _.each(queries, function(q) {
        var _q = $scope.ejs.FilteredQuery(
          querySrv.toEjsObj(q),
          filterSrv.getBoolFilter(filterSrv.ids()));

        request = request
          .facet($scope.ejs.QueryFacet(q.id)
            .query(_q)
          ).size(0);
      });

      // Populate the inspector panel
      $scope.inspector = request.toJSON();

      // Then run it
      var results = $scope.ejs.doSearch(dashboard.indices[_segment], request);

      // Populate scope when we have results
      results.then(function(results) {
        $scope.panelMeta.loading = false;
        if(_segment === 0) {
          $scope.hits = 0;
          $scope.data = [];
          query_id = $scope.query_id = new Date().getTime();
        }

        // Check for error and abort if found
        if(!(_.isUndefined(results.error))) {
          $scope.panel.error = $scope.parse_error(results.error);
          return;
        }

        // Make sure we're still on the same query/queries
        if($scope.query_id === query_id) {
          var i = 0;
          _.each(queries, function(q) {
            var v = results.facets[q.id];
            var hits = _.isUndefined($scope.data[i]) || _segment === 0 ?
              v.count : $scope.data[i].hits+v.count;
            $scope.hits += v.count;

            // Create series
            $scope.data[i] = {
              info: q,
              id: q.id,
              hits: hits,
              data: [[i,hits]]
            };

            i++;
          });
          $scope.$emit('render');
          if(_segment < dashboard.indices.length-1) {
            $scope.get_data(_segment+1,query_id);
          }

        }
      });
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh =  false;
      $scope.$emit('render');
    };
  });

});
