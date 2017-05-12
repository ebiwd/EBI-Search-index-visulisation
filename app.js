var svg = d3.select("svg"),
  width = +svg.attr("width"),
  height = +svg.attr("height"),
  tau = 2 * Math.PI,
  color = d3.scaleOrdinal(d3.schemeCategory20);

d3.json("data.json", function(error, graph) {
  if (error) throw error;

  graph = customStratify(graph.domains);

  var t = d3.transition()
      .duration(750)
      .ease(d3.easeLinear);

  // Setup the tool tip.  Note that this is just one example, and that many styling options are available.
  // See original documentation for more details on styling: http://labratrevenge.com/d3-tip/
  var tool_tip = d3.tip()
    .attr("class", "d3-tip")
    .offset([-8, 0])
    .direction(function(d,i) {
      // console.log(d.x,d.y);
      if (d.x<580) {
        return 'e'; // place label to right when we get near left
      }
      if (d.x>900) {
        return 'w'; // place label to left when we get near right
      }

      return 'n'; //default to above
    })
    .html(function(d) {
      var dataSetSize = Math.floor(d.size/10000)/100;

      if (dataSetSize > 0.02) {
        return dataSetSize+"M" + "<br/>" + d.name;
      } else {
        // return thousands of records
        return Math.floor(d.size/10)/100+"K" + "<br/>" + d.name;
      }
    })
  ;
  svg.call(tool_tip);

  var link = svg.append("g")
      .attr("class", "links")
    .selectAll("line")
    .data(graph.links)
    .enter().append("line")
      .attr('opacity', 0)
      .attr("stroke-width", function(d) { return Math.sqrt(d.value); })
  ;

  var node = svg.append("g")
      .attr("class", "nodes")
    .selectAll(".nodes")
    .data(graph.nodes)
    .enter().append("g")
      .attr("transform", function(d) { return "translate("+d.x+","+d.y+ ")"; })
  ;

  node.append("circle")
    .attr("r", function(d) { return Math.sqrt(Math.sqrt(d.size/100))+0; })
      // .attr("cx", function(d) { return d.x; })
      // .attr("cy", function(d) { return d.y; })
    .attr("fill", function(d) { return "rgba(255,255,255,0.0)"; })
    .attr('opacity', 0)
    .attr("stroke", function(d) { return color(d.group); })
    .on("mouseover", tool_tip.show)
    .on("mouseout", tool_tip.hide)

      // .call(d3.drag()
      //   .on("start", dragstarted)
      //   .on("drag", dragged)
      //   .on("end", dragended))
  ;

  // don't overlap labels
  window.collide = d3.bboxCollide((a) => {
    return [[a.offsetCornerX - 5, a.offsetCornerY - 10],[a.offsetCornerX + a.width + 5, a.offsetCornerY + a.height+ 5]]
  })
   .strength(0.5)
   .iterations(1)
  ;

  const corenodes = graph.nodes
    .filter(d => d.level == "1");

  // annotations
  window.makeAnnotations = d3.annotation()
    .type(d3.annotationLabel)
    .annotations(corenodes
    .map((d,i) => {
      // console.log(d,i);
      return {
        data: {x: d.x, y: d.y, group: d.group},
        note: { label: d.name
          // align: "middle",
          // orientation: "fixed"
           },
        // connector: { end: "arrow"  },
        subject: { radius: 50, radiusPadding: 10 },
        className: "group-"+d.group
      // .attr("stroke", function(d) { return color(d.group); })
      }
    })
    )
    .accessors({ x: d => d.x , y: d => d.y})
  ;

  svg.append("g")
    .attr('opacity', 0)
    .attr("class", "annotation-group")
    .call(makeAnnotations)
  ;

  // simulation
  var simulation = d3.forceSimulation(graph.nodes)
    .velocityDecay(0.1)
    .alphaDecay(.1)
    .alpha(1)
    // .alphaTarget(.02)
    .force("x", d3.forceX().strength(0.038))
    .force("y", d3.forceY().strength(0.238))
    .force("link", d3.forceLink().id(function(d) { return d.id; }).distance(200).strength(1))
    .force("collide", d3.forceCollide().radius(function(d) { return Math.sqrt(Math.sqrt(d.size/100))+1; }).strength(1).iterations(10))
    .force("center", d3.forceCenter(width / 1.7, height / 2.3))
    .on("tick", ticked)
    .on("end", function() {
      const noteBoxes = makeAnnotations.collection().noteNodes
      window.labelForce = d3.forceSimulation(noteBoxes)
        .force("x", d3.forceX(a => a.positionX).strength(a => Math.max(0.25, Math.min(3, Math.abs(a.x - a.positionX) / 20))))
        .force("y", d3.forceY(a => a.positionY).strength(a => Math.max(0.25, Math.min(3, Math.abs(a.x - a.positionX) / 20))))
       .force("collision", window.collide)
        .alpha(0.5)
        .on('tick', d => {
          makeAnnotations.annotations()
          .forEach((d, i) => {
            const match = noteBoxes[i]
              d.dx = match.x - match.positionX
              d.dy = match.y - match.positionY
          })
          // makeAnnotations.update()
        })
    })
  ;

  // node.append("title")
  //   .text(function(d) { return d.name; });

  simulation.force("link")
      .links(graph.links)
      .distance(10);

  // make things visible
  d3.selectAll("circle").transition(t)
    .delay(1000)
    .attr("opacity", 1)
  ;

  d3.selectAll(".legendSize")
    .transition(t)
      .delay(1900)
      .attr("opacity", .5)
  ;

  d3.selectAll(".annotation-group")
    .transition(t)
      .delay(function(d) { return Math.random()*2000+2000;})
      .attr("opacity", 1)
  ;

  // Interactivity
  function dragstarted(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragended(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  function mouseover(d) {
    console.log(d);
  }

  function ticked() {
    node
        .attr("transform", function(d) { return "translate("+d.x+","+d.y+ ")"; });
    link
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; })
    ;

    makeAnnotations.annotations()
      .forEach((d, i) => {
        d.position = corenodes[i]
      })
    ;
  } // end ticked

});

// Legend
var linearSize = d3.scalePow().exponent(.19).domain([0,80000000]).range([1, 25]);

svg.append("g")
  .attr("class", "legendSize")
  .attr("stroke","#fff")
  .attr("fill","#000")
  .attr("transform", "translate("+(width-250)+", "+(height-150)+")")
;

var legendSize = d3.legendSize()
  .scale(linearSize)
  .shape('circle')
  .shapePadding(2)
  .labelFormat('.0s')
  .cells(5)
  .title('Millions of entries in each domain')
  .labelOffset(15)
  .orient('horizontal')
;

svg.select(".legendSize")
  .attr("opacity","0")
  .call(legendSize)
;

svg.select(".legendSize text.legendTitle")
  .attr("transform", function(d) { return "translate(0,-10)"; })
  .call(legendSize)
;

// Build data tree
// we rebuild our weird structure into d3
function customStratify(data) {
  // console.log(data[0]);
  var len = data.length,
      newData = {"nodes":[],"links":[]}, //data structure
      i;

  for ( i=0; i < len; i+=1 ) {
    // assign labels
    var parentTitle = 'to generate';
    switch (i) {
      case 0:
        parentTitle = 'Genomes & metagenomes';
        fixedX=50;
        fixedY=20;
        break;
      case 1:
        parentTitle = 'Nucelotide sequences';
        fixedX=50;
        fixedY=20;
        break;
      case 2:
        parentTitle = 'Protein sequences';
        fixedX=50;
        fixedY=20;
        break;
      case 3:
        parentTitle = 'Macromolecular structures';
        fixedX=500;
        fixedY=20;
        break;
      case 4:
        parentTitle = 'Macromolecular structures';
        fixedX=50;
        fixedY=20;
        break;
      case 5:
        parentTitle = 'Gene expression';
        fixedX=50;
        fixedY=20;
        break;
      case 6:
        parentTitle = 'Molecular interactions';
        fixedX=50;
        fixedY=20;
        break;
      case 7:
        parentTitle = 'Reactions, pathways & diseases';
        fixedX=10;
        fixedY=10;
        break;
      case 8:
        parentTitle = 'Gene expression';
        fixedX=50;
        fixedY=20;
        break;
      case 9:
        parentTitle = 'Protein expression data';
        fixedX=50;
        fixedY=20;
        break;
      case 10:
        parentTitle = 'Enzymes';
        fixedX=50;
        fixedY=20;
        break;
      case 11:
        parentTitle = 'Literature';
        fixedX=50;
        fixedY=20;
        break;
      case 12:
        parentTitle = 'Samples & ontologies';
        fixedX=50;
        fixedY=20;
        break;
      case 13:
        parentTitle = 'EBI web';
        fixedX=500;
        fixedY=30;
        break;
    }

    newData.nodes.push( { "id": 'parent-record-'+i, "name": parentTitle, "group": i, "size": 1, "level": 1, "x": fixedX, "y": fixedY });

    for ( i2=0; i2 < data[ i ].subdomains.domain.length; i2+=1 ) {
      var activeRecord = data[i].subdomains.domain[i2];
      // not a subtree?
      if (activeRecord['subdomains'] == undefined) {
        if (activeRecord['-description'] == undefined) {
          activeRecord['-description'] = parentTitle;
        }
        var activeName = activeRecord['-description'];

        newData.nodes.push( { "id": activeName+'-'+i+'-'+i2, "name": activeName, "group": i, "size": activeRecord.indexInfos.indexInfo[0]['#text'], "filesize": activeRecord.indexInfos.indexInfo[2]['#text'], "level": 2, "x": fixedX, "y": fixedY });
        newData.links.push( { "source": activeName+'-'+i+'-'+i2, "target": 'parent-record-'+i, "value": 1 });
      } else {
        // node and link for sub-record
        newData.nodes.push( { "id": 'parent-sub-record-'+i+'-'+i2, "name": activeRecord['-description'], "group": i, "size": 100, "level": 2, "x": fixedX, "y": fixedY });
        newData.links.push( { "source": 'parent-sub-record-'+i+'-'+i2, "target": 'parent-record-'+i, "value": 1 });

        // create node for each child search archive
        for ( i3=0; i3 < activeRecord['subdomains'].domain.length; i3+=1 ) {

          var activeSubdomainRecord = activeRecord['subdomains'].domain[i3];
          // not a subtree?
          if (activeSubdomainRecord['subdomains'] == undefined) {

            if (activeSubdomainRecord['-description'] == undefined) {
              activeSubdomainRecord['-description'] = parentTitle;
            }
            var activeSubdomainName = activeSubdomainRecord['-description'];

            newData.nodes.push( { "id": activeSubdomainName+'-'+i+'-'+i2+'-'+i3, "name": activeSubdomainName, "group": i, "size": activeSubdomainRecord.indexInfos.indexInfo[0]['#text'], "filesize": activeSubdomainRecord.indexInfos.indexInfo[2]['#text'], "level": 3, "x": fixedX, "y": fixedY });
            newData.links.push( { "source": activeSubdomainName+'-'+i+'-'+i2+'-'+i3, "target": 'parent-sub-record-'+i+'-'+i2, "value": 1 });
          } else {
            // node and link for sub-sub-record
            newData.nodes.push( { "id": 'parent-sub-record-'+i+'-'+i2+'-'+i3, "name": activeSubdomainRecord['-description'], "group": i, "size": 100, "level": 4, "x": fixedX, "y": fixedY });
            newData.links.push( { "source": 'parent-sub-record-'+i+'-'+i2+'-'+i3, "target": 'parent-record-'+i, "value": 1 });

            // create node for each child-child search archive --- OY :(
            for ( i4=0; i4 < activeSubdomainRecord['subdomains'].domain.length; i4+=1 ) {
              var activeSubSubdomainRecord = activeSubdomainRecord['subdomains'].domain[i4];
              // not a subtree?
              if (activeSubSubdomainRecord != undefined) {
                if (activeSubSubdomainRecord['subdomains'] == undefined) {

                  if (activeSubSubdomainRecord['-description'] != undefined) {
                    var activeSubSubdomainName = activeSubSubdomainRecord['-description'];
                  } else {
                    var activeSubSubdomainName = ' ';
                  }

                  newData.nodes.push( { "id": activeSubSubdomainName+'-'+i+'-'+i2+'-'+i3+'-'+i4, "name": activeSubSubdomainName, "group": i, "size": activeSubSubdomainRecord.indexInfos.indexInfo[0]['#text'], "level": 4, "x": fixedX, "y": fixedY });
                  newData.links.push( { "source": activeSubSubdomainName+'-'+i+'-'+i2+'-'+i3+'-'+i4, "target": 'parent-sub-record-'+i+'-'+i2+'-'+i3, "value": 1 });
                } else {
                  // create node for each child-child-child search archive --- let's hope none!
                  console.log(activeSubSubdomainRecord);

                }
              }
            } // end i4 loop
          }
        } // end i3 loop
      }
    } // end i2 loop
  } // end i loop
  // console.log(newData);
  return newData;
}
