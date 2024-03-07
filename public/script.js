$(document).ready(function () {

    // Définition des SVG
    var svg_map = d3.select("#map").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .append("g");

    var global = document.getElementById("global");

    var svg_barre_buts = d3.select("#barre-buts").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .append("g");

    var svg_pie_chart = d3.select("#pie-chart").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .append("g");

    var svg_outcome = d3.select("#outcome").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .append("g");

    var svg_buts = d3.select("#buts").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .append("g");

    var svg_historique = d3.select("#historique").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .append("g");


    // Constantes
    // Echelle de couleurs
    const n_colors = 5;
    const redColors = create_colorscale(n_colors);

    var color_pays = d3.scaleQuantile().range(redColors);

    const blueColor = "#17548C";
    const darkblueColor = "#21304D";
    const redColor = "#ED2939";
    const outcomeColors = [darkblueColor, "lightgray", redColor];


    // Cacher les stats par pays au début
    $("#stats-par-pays").css("display", "none");
    // Réinitialiser l'input pays
    $("#input-pays").val("");
    // Réinitialiser le pays selectionné dans le HTML
    $('#stats-par-pays').data('pays-selected', "");

    global.style.width = "100%";

    // Charger le fichier CSV
    d3.csv("matchs_france.csv").then(data => {
        return data.map((d, i) => {
            let r = d

            r.score1 = parseInt(d.score1);
            r.score2 = parseInt(d.score2);

            r.equipeAdverse_avecaccents = (d.equipe1 === "France") ? d.equipe2 : d.equipe1;
            r.scoreFrance = (d.equipe1 === "France") ? d.score1 : d.score2;
            r.scoreAdverse = (d.equipe1 === "France") ? d.score2 : d.score1;

            r.equipe1 = removeAccents(d.equipe1);
            r.equipe2 = removeAccents(d.equipe2);
            r.equipeAdverse = removeAccents(d.equipeAdverse_avecaccents);

            r.time = parseDate(d.date);

            r.ecart = Math.abs(r.score1 - r.score2); // ecart de points
            r.total_buts = r.score1 + r.score2; // nombre de buts marqués (par les deux équipes)

            r.competition_type = (d.competition === "Match amical") ? "Matchs amicaux" : "Matchs officiels";

            return r
        })
    }).then(function (data) {
        // FILTRAGE DES DONNEES PAR DATE

        // Trouver la date minimale et maximale
        const minDate = d3.min(data.map(d => d.time));
        const maxDate = d3.max(data.map(d => d.time));

        // Extraire les années minimale et maximale
        const minYear = minDate.getFullYear();
        const maxYear = maxDate.getFullYear();

        // Afficher les dates initiales dans le bloc #selected-dates
        $("#selected-dates").html(`Données entre <b2>${minYear}</b2> et <b2>${maxYear}</b2>`);

        var start_date = minYear;
        var end_date = maxYear;

        /// Actions dynamiques

        // Filtrer les données en fonction du filtre de date
        // Initialiser le slider de date
        var filteredData = data;
        $("#slider-date").slider({
            range: true,
            min: minYear,
            max: maxYear,
            values: [minYear, maxYear],
            slide: function (event, ui) {
                // Mettre à jour les valeurs min et max des dates sélectionnées
                // var start_date = ui.values[0];
                // var end_date = ui.values[1];
                start_date = ui.values[0];
                end_date = ui.values[1];

                // Afficher les dates sélectionnées dans le bloc #selected-dates
                $("#selected-dates").html(`Données entre <b2>${start_date}</b2> et <b2>${end_date}</b2>`);

                // Filtrer les données
                filteredData = data.filter(d => d.time.getFullYear() >= start_date && d.time.getFullYear() <= end_date);
                
                // Updater la carte et les autres graphiques
                process_data(filteredData);
            }
        });

        $('#fermer-stats-par-pays').on("click", function() {
            // Réinitialisation des paramètres
            $("#stats-par-pays").css("display", "none");
            $("#input-pays").val("");

            process_data(filteredData);
        });

        window.onresize = function() {
            // Updater la carte et les autres graphiques
            process_data(filteredData);
        };
        
        // Générer la carte et les graphiques sur les données
        process_data(filteredData);

    });


    // Génère les graphiques à partir des données
    function process_data(data) {
        // COLORIAGE DES PAYS EN FONCTION DU NOMBRE DE MATCHS
        // On groupe les données par pays et on compte le nombre de matchs
        var data_byPays = [...d3.rollup(
            data,
            v => v.length,
            d => { if (d.equipe1 == "France") { return d.equipe2 } else { return d.equipe1 } }
        )];
        // Modifion du domaine de la color scale
        color_pays.domain(data_byPays.map(d => d[1]));
        
        d3.json("pays.geojson").then(function (json) {
            // Pour chaque pays, on colorie le path en fonction du nombre de matchs
            for (var j = 0; j < json.features.length; j++) {
                // Nom du pays
                var jsonPays = removeAccents(json.features[j].properties.name_fr);
                // Sélection du bon pays
                var dataPaysdata = data_byPays.find((row) => row[0] == jsonPays);
                if (dataPaysdata) {
                    var nbMatchs = dataPaysdata[1];
                    json.features[j].properties.nb_matchs = nbMatchs;

                    json.features[j].properties.matchs_data = data.filter(d => d.equipeAdverse == jsonPays);
                }
            }
            refit_global(data, json);


            // Recherche de pays 
            var liste_pays_csv = [...new Set(data.map(d => d.equipeAdverse_avecaccents))];

            var liste_pays = [...d3.intersection(
                [...new Set(liste_pays_csv.map(d => removeAccents(d).toLowerCase()))], 
                [...new Set(json.features.map(d => removeAccents(d.properties.name_fr).toLowerCase()))]
            )];
            
            liste_pays = liste_pays_csv.filter(d => liste_pays.includes(removeAccents(d).toLowerCase()));

            $("#input-pays").autocomplete({
                source: liste_pays,
                select: function(event, ui) {
                    // Update les stats
                    var pays_recherche = removeAccents(ui.item.value).toLowerCase();
                    var element_pays_recherche = json.features.find(d => removeAccents(d.properties.name_fr).toLowerCase() == pays_recherche);
                    $("#stats-par-pays").css("display", "inline-block");
                    refit_global(data, json);
                    update_stats_pays(element_pays_recherche.properties.name_fr, element_pays_recherche.properties.matchs_data);
                }
            });

            $("#input-pays").on('keyup', function(event) {
                if(event.key === "Enter") {
                    var pays_recherche = removeAccents($(this).val()).toLowerCase();
                    var element_pays_recherche = json.features.find(d => removeAccents(d.properties.name_fr).toLowerCase() == pays_recherche);
                    $("#stats-par-pays").css("display", "inline-block");
                    refit_global(data, json);
                    update_stats_pays(element_pays_recherche.properties.name_fr, element_pays_recherche.properties.matchs_data);
                }
            });

        
            // Updater les stats par pays
            if ($("#stats-par-pays").css("display") != "none") {
                var pays_recherche = $('#stats-par-pays').data('pays-selected');
                if (pays_recherche) {
                    var element_pays_recherche = json.features.find(d => removeAccents(d.properties.name_fr).toLowerCase() == pays_recherche);
                    $("#stats-par-pays").css("display", "inline-block");
                    refit_global(data, json);
                    update_stats_pays(element_pays_recherche.properties.name_fr, element_pays_recherche.properties.matchs_data);
                }
                else {
                    console.log("pays-selected vide dans le HTML");
                }
            }
        });
    } 

    // Supprime et recrée les stats par pays
    function update_stats_pays(pays_select, pays_data) {
        if ($("#stats-par-pays").css("display") == "none") {
            // Afficher le volet de stats par pays
            $("#stats-par-pays").css("display", "inline-block");
        }

        // Supprime les stats
        svg_outcome.selectAll("*").remove();
        svg_buts.selectAll("*").remove();
        svg_historique.selectAll("*").remove();
        $("#sous-titre").html("");
        $("#matchs").html("");
        $("#buts-marques").html("");
        $("#historique-titre").html("");
        $("#ecart").html("");

        if (pays_data) {
            // Garder le pays sélectionné dans le HTML
            $('#stats-par-pays').data('pays-selected', removeAccents(pays_select).toLowerCase());

            // Sous-titre
            $("#sous-titre").html(`${pays_select}`);

            // Nombre de matchs
            $("#matchs").html(`<b3>${pays_data.length}</b3> matchs joués contre la France`);

            // Ajouter victoires/défaites/nuls
            bar_outcome(pays_data);

            // Histogramme du nombre de buts
            histogram_buts(pays_data, pays_select);

            // Plus grand écart de points 
            difference_buts(pays_data);

            // Graphe dans le temps histogramme victoires/défaites/nuls
            historique_matchs(pays_data);

            // Plus grande série d'invincibilité

        }
        else {
            $("#matchs").html("Pas de données");
        }
    }

    // Ajouter le tooltip pour afficher le pays et le nombre de matchs
    const tooltip = d3.select("#map").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute");

    // Lorsque la souris est sur le pays
    function mouseover(event, d) {
        if (d.properties.nb_matchs) {
            svg_map.selectAll("path").attr("opacity", 0.3);
            svg_map.selectAll("path")
                .filter(f => f == d)
                .attr("opacity", 1);

            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html("Pays : " + d.properties.name_fr + "<br/>Matchs : " + d.properties.nb_matchs)
                .style("left", event.layerX + "px")
                .style("top", event.layerY + "px");
        }
    }

    // Pour suivre le mouvement de la souris
    function mousemove(event, d) {
        tooltip.style("left", event.layerX + "px")
            .style("top", event.layerY + "px");
    }

    // Lorsque la souris quitte un pays
    function mouseout(event, d) {
        tooltip.transition()
            .duration(500)
            .style("opacity", 0);

        d3.selectAll("#tooltip").remove();
        svg_map.selectAll("path").attr("opacity", 1);
    }

    // Ajouter événement quand on clique sur un pays : affichage stats à droite
    function click(event, d) { 
        svg_map.selectAll("path").attr("opacity", 0.5);
        svg_map.selectAll("path")
            .filter(f => f == d)
            .attr("opacity", 1);

        var pays_select = d.properties.name_fr;
        var pays_data = d.properties.matchs_data;

        update_stats_pays(pays_select, pays_data);

    }
    



    function france_adversairs_buts(data) {
        var start_date = d3.min(data.map(d => d.time)).getFullYear();
        var end_date = d3.max(data.map(d => d.time)).getFullYear();
        
        var equipes = data.map(d => {if (d.equipe1 == "France") {return d.equipe2} else {return d.equipe1}});
        var pays_affrontes = [...new Set(equipes)];
        var nb_pays_affrontes = pays_affrontes.length

        var matchs_joues = data.length

        var buts_pris = d3.sum(data, d => d.scoreAdverse);
        var buts_marques = d3.sum(data, d => d.scoreFrance);

        $("#date").html(`Entre <b1>${start_date}</b1> et <b1>${end_date}</b1> : `);
        $("#matchs-joues").html(`<b>${matchs_joues}</b> matchs <wbr> joués`);
        $("#nombre-adversaires").html(`<b>${nb_pays_affrontes}</b> adversaires <wbr> affrontés`);
        $("#nombre-buts-marques").html(`<b>${buts_marques}</b> buts <wbr> marqués`);
        $("#nombre-buts-pris").html(`<b>${buts_pris}</b> buts <wbr> pris`);

        
    }

    function win_loss(data) {
        const bar_width = $("#barre-buts").width() * 4/5;
        const bar_height = 30;
        const x_offset = ($("#barre-buts").width() - bar_width) / 2;
        const y_offset = ($("#barre-buts").height() - bar_height - 20) / 3;

        var outcome = d3.rollup(
            data,
            v => v.length,
            d => d.result_france
            );
        // Change order
        outcome = [
            ["Victoires", outcome.get("win")], 
            ["Nuls", outcome.get("draw")],
            ["Défaites", outcome.get("loss")]
        ].filter(v => v[1] !== undefined);

        // Initialize cumulative sum
        let cumulativeSum = 0;
        // Generate the desired structure
        var layers = d3.map(outcome, ([category, count], i) => {
            var start = cumulativeSum;
            cumulativeSum += count;
            var end = cumulativeSum;

            let res = {};
            res[0] = start;
            res[1] = end;
            res.outcome = category;
            res.count = count;
            return res
        });

        const color = d3.scaleOrdinal()
            .domain(["Victoires", "Nuls", "Défaites"])
            .range(outcomeColors);
        const x = d3.scaleLinear()
            .domain([0, data.length])
            .range([0, bar_width]);

        // Supprimer les éléments text existants pour corriger la superposition
        svg_barre_buts.selectAll(".outcomeText").remove();
        svg_barre_buts.selectAll(".outcome").remove();

        svg_barre_buts.selectAll(".outcome").data(layers).enter().append("rect")
            // .attr("id", "barre_buts")
            .attr("class", "outcome")
            .attr("fill", d => color(d.outcome))
            .attr("stroke", "white")
            .attr("x", d => x_offset + x(d[0]))
            .attr("y", y_offset)
            .attr("height", bar_height)
            .attr("width", d => x(d[1]) - x(d[0]));
        
       svg_barre_buts.selectAll(".outcomeText").data(layers).enter().append("text")
            .attr("class", "outcomeText")
            .attr("x", d => x_offset + x(d[0]))
            .attr("y", y_offset + bar_height + 20)
            .text(d => d.outcome + ": " + d.count);
    }

    function pie_chart_competition(data) {
        const width_pie_conteneur = $("#pie-chart").width();
        const height_pie_conteneur = $("#pie-chart").height();

        const radius = Math.min(height_pie_conteneur / 2, width_pie_conteneur / 2);
        const margin = 30;

        svg_pie_chart.selectAll("*").remove();

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);
        const pie = d3.pie().value(d => d[1]);
        var pie_data = [...d3.rollup(
            data,
            v => v.length,
            d => d.competition_type
        )];
        const colorScale = d3.scaleOrdinal()
        .domain(pie_data.map(d => d[0]))
        .range([blueColor, redColor]);

        svg_pie_chart.selectAll(".pie-chart").data(pie(pie_data)).enter()
            .append("path")
            // .attr("id", "stats-globales")
            .attr("classe", "pie-chart")
            .attr("d", arc)
            .attr("fill", d => colorScale(d.data[0]))
            .attr("stroke", "white")
            .attr("transform", `translate(${radius},${radius})`);
        
        // Affichage des pourcentages dans le pie chart
        var total_match = d3.sum(pie_data.map(function(d) { 
            return d[1]; 
        }));
        svg_pie_chart.selectAll(".pie-chart").data(pie(pie_data)).enter()
            .append("text")
            .attr("class", "piet-text")
            .attr("transform", function(d) { 
                translate_pie = "translate(" + (radius + arc.centroid(d)[0]) + "," + (radius + arc.centroid(d)[1]) + ")"; // Décalage enx et y pour correspondre au milieu du pie chart svg
                return translate_pie; 
            })
            .attr("dy", "0.35em")
            .style("text-anchor", "middle")
            .style("fill", "white")
            .style("font-size", "11px")
            .style("font-weight", "normal")
            .text(function(d) { 
                txt = ((d.data[1] / total_match) * 100).toFixed(1) + "%";
                return txt; 
            });
        
        // Légende
        var legend_rect_size = 18; // Taille des rect de couleur
        var legend_space = 4; // Espacement vertical
        var legend_height = legend_rect_size + legend_space;
        var legend_position = {x: 2*radius + margin, y: radius/2}; // Position de la légende dans le conteneur svg


        var legend = svg_pie_chart.selectAll('.legend').data(colorScale.domain()).enter()
            .append('g')
            .attr('class', 'legend')
            .attr('transform', function(d, i) {
                var horz = legend_position.x;
                var vert = i * legend_height + legend_position.y;
                return 'translate(' + horz + ',' + vert + ')';
            });

        // Rect de couleur
        legend.append('rect')
            .attr('width', legend_rect_size)
            .attr('height', legend_rect_size)
            .style('fill', colorScale)
            .style('stroke', "none");

        // Texte de légende
        legend.append('text')
            .attr('x', legend_rect_size + legend_space)
            .attr('y', legend_rect_size - legend_space)
            .text(function(d) { return d; });
    }

    function bar_outcome(pays_data) {
        const bar_width = $("#outcome").width() * 4/5;
        const bar_height = 20;
        const x_offset = ($("#outcome").width() - bar_width) / 2;
        var outcome = d3.rollup(
            pays_data,
            v => v.length,
            d => d.result_france
            );
        // Change order
        outcome = [
            ["Victoires", outcome.get("win")], 
            ["Nuls", outcome.get("draw")],
            ["Défaites", outcome.get("loss")]
        ].filter(v => v[1] !== undefined);
        // Initialize cumulative sum
        let cumulativeSum = 0;
        // Generate the desired structure
        var layers = d3.map(outcome, ([category, count], i) => {
            var start = cumulativeSum;
            cumulativeSum += count;
            var end = cumulativeSum;

            let res = {};
            res[0] = start;
            res[1] = end;
            res.outcome = category;
            res.count = count;
            return res
        });

        const color = d3.scaleOrdinal()
            .domain(["Victoires", "Nuls", "Défaites"])
            .range(outcomeColors);
        const x = d3.scaleLinear()
            .domain([0, pays_data.length])
            .range([0, bar_width]);

        svg_outcome.selectAll(".outcome").data(layers).enter().append("rect")
            .attr("id", "pays_stat")
            .attr("fill", d => color(d.outcome))
            .attr("stroke", "white")
            .attr("x", d => x_offset + x(d[0]))
            .attr("y", 0)
            .attr("height", bar_height)
            .attr("width", d => x(d[1]) - x(d[0]));
        svg_outcome.selectAll(".outcome").data(layers).enter().append("text")
            .attr("id", "pays_stat")
            .attr("x", d => x_offset + x(d[0]))
            .attr("y", bar_height + 20)
            .text(d => d.outcome + ": " + d.count);
    }

    function histogram_buts(pays_data, pays_select) {
        const histo_height = $("#buts").height() * 2/3;
        const histo_width = $("#buts").width() * 2/3
        const x_offset = ($("#buts").width() - histo_width) / 2;
        const y_offset = 20;

        var buts_france = d3.sum(d3.map(pays_data, d => d.scoreFrance));
        var buts_adverse = d3.sum(d3.map(pays_data, d => d.scoreAdverse));

        let buts = [];
        buts[0] = ["France", buts_france];
        buts[1] = [pays_select, buts_adverse];

        const y = d3.scaleLinear()
            .domain([0, Math.max(buts_france, buts_adverse)])
            .range([0, histo_height]);
        const x = d3.scaleBand()
            .domain(["France", pays_select])
            .range([0, histo_width])
            .padding(0.2);
        const color = d3.scaleOrdinal()
            .domain(["France", pays_select])
            .range([blueColor, redColor]);

        $("#buts-marques").html(`<b3>Buts marqués :</b3>`);

        svg_buts.selectAll(".buts").data(buts).enter().append("rect")
            .attr("id", "pays_stat")
            .attr("x", d=> x_offset + x(d[0]))
            .attr("y",  d=> 10 + y_offset + histo_height - y(d[1]))
            .attr("height", d=> y(d[1]))
            .attr("width", x.bandwidth())
            .attr("stroke", "none")
            .attr("fill", d=> color(d[0]));
        svg_buts.selectAll(".buts").data(buts).enter().append("text")
            .attr("id", "pays_stat")
            .attr("x", d => x_offset + x(d[0]) + x.bandwidth() / 2)
            .attr("y",  d => y_offset + histo_height - y(d[1]))
            .attr("text-anchor", "middle")
            .text(d => d[1]);

        const xAxis = g => g
            .attr("id", "pays_stat")
            .attr("transform", `translate(${x_offset},${y_offset + 10 + histo_height})`)
            .call(d3.axisBottom(x));

        svg_buts.append("g")
            .call(xAxis);
    }

    // const tooltip_ecart = d3.select("#buts-conteneur").append("div")
    //     .attr("class", "tooltip")
    //     .style("position", "absolute")
    //     .style("margin-left", "10px");

    function difference_buts(pays_data) {
        var ecart_max_data = d3.greatest(pays_data, (a, b) => d3.ascending(a.ecart, b.ecart));
        var ecart_max = ecart_max_data.ecart;
        // Plus gros écart de buts
        $("#ecart").html(`<b>${ecart_max}</b>  Plus <br>grand écart<br> de buts`);
        // Tooltip avec des informations sur le match
        $("#ecart").on("mouseover", () => {
            // tooltip_ecart.transition()
            //     .duration(200)
            //     .style("opacity", 1);

            let d = ecart_max_data;
            let g = svg_historique.selectAll("g");

            // tooltip_ecart.html(`Match du ${d.date}`);

            g.selectAll("rect").attr("opacity", 0.3);
            g.selectAll("rect")
                .filter(f => f == d)
                .attr("opacity", 1);

            tooltip_historique.transition()
                .duration(200)
                .style("opacity", 1);
            // On affiche la date, la compétition et le score du match
            tooltip_historique.html("Date : " + d.date + "<br/>Compétition : " + d.competition + "<br/>Score : " + d.score1 + "-" + d.score2);
        })
        // Supprimer la tooltip
        .on("mouseout", (e, d) => {
            // tooltip_ecart.transition()
            //     .duration(500)
            //     .style("opacity", 0);
            
            svg_historique.selectAll("rect").attr("opacity", 1);
            tooltip_historique.transition()
                .duration(500)
                .style("opacity", 0);
        });
    }

    function map(data, json) {
        const legend_width = 100;
        const map_width = $("#map").width() - legend_width;
        const map_height = $("#map").height() - 2*parseFloat($("#map").css("padding"));

        // Projection
        var projection = d3.geoMercator()
            .center([2.454071, 46.279229]) // Longitude et latitude du centre de la carte (France)
            .fitSize([map_width, map_height], json); // Fit la taille de la carte
        var path = d3.geoPath().projection(projection);
        // Coloration
        svg_map.selectAll("path")
            .data(json.features)
            .join("path")
            .attr("d", path)
            .attr("stroke", "white")
            .attr("id", d => "pays-" + removeAccents(d.properties.name_fr).toLowerCase())
            .style("fill", function (d) {
                // On prend la valeur recupérée plus haut
                var nbMatchs = d.properties.nb_matchs;
                if (nbMatchs || nbMatchs == 0) {
                    return color_pays(nbMatchs);
                }
                else if (d.properties.name_fr == "France") {
                    return blueColor // couleur bleue
                }
                else {
                    // si valeur manquante alors on colore en gris
                    return "#ccc";
                }
            })
            .on("mouseover", mouseover) // Attachement de la gestion de l'événement mouseover
            .on("mousemove", mousemove) // Attachement de la gestion de l'événement mousemove
            .on("mouseout", mouseout)  // Attachement de la gestion de l'événement mouseout
            .on("click", function (event, d) {
                if (d.properties.nb_matchs) {
                    // Afficher le volet de stats par pays
                    $("#stats-par-pays").css("display", "inline-block");
                    refit_global(data, json);
                    click(event, d, data);
                }
            }); // Attachement de la gestion de l'événement click


        // Supprimer la légende existante
        svg_map.select(".legend").remove();
            
        // Dessiner une nouvelle légende
        var legend = svg_map.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(" + (map_width - 50) + ",80)");

        // Ajouter un titre à la légende
        legend.append("text")
            .attr("class", "legend-title")
            .attr("x", 0)
            .attr("y", -25)
            .text("Nombre de matchs");

        legend.append("text")
            .attr("class", "legend-title")
            .attr("x", 0)
            .attr("y", -10)
            .text("joués contre la France");

        var layers = [];
        for (var i = 0; i < color_pays.range().length; i++) {
            layers[i] = [];
            layers[i][0] = color_pays.range()[i];
            var interval = color_pays.invertExtent(color_pays.range()[i]);
            var start = Math.ceil(interval[0]);
            var end = Math.ceil(interval[1]-1);
            if (i == color_pays.range().length - 1) {
                end = interval[1]; // Dernière valeur
            }

            if (start == end) {
                layers[i][1] = start;
            }
            else if ((start > end)){
                layers[i][1] = NaN;
            }
            else {
                layers[i][1] = `${start}-${end}`;
            }
        }  
        layers = layers.filter(d => !Number.isNaN(d[1]));

        legend.selectAll("g").data(layers).enter().append("g")
            .attr("transform", (d,i) => `translate(0,${i * 20})`);
        
        legend.selectAll("g").append("rect")
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", d => d[0]);
        
        legend.selectAll("g").append("text")
            .attr("x", 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .text(d => d[1]);
    }


    // Tooltip pour afficher des informations intéressantes sur le match 
    const tooltip_historique = d3.select("#historique").append("div")
        .attr("class", "tooltip") 
        .style("position", "relative");

    function historique_matchs(pays_data) {
        // Historique des matchs sous forme de timeline avec un code couleur en fonction de l'outcome du match
        const width = $("#historique").width() * 2/3;
        const height = $("#historique").height() * 2/3;
        const x_offset = ($("#historique").width() - width) / 2;
        const y_offset = 0; // ($("#historique").height() - height) / 2;

        // On regroupe les matchs sur 4 ans
        const step = 4; 

        pays_data_grouped = [...d3.group(
            pays_data, 
            d => Math.floor(d.time.getFullYear() / step)
        )];
        
        // Scales
        const color = d3.scaleOrdinal()
            .domain(["win", "draw", "loss"])
            .range(outcomeColors);
        const x = d3.scaleBand()
            .domain(d3.range(
                d3.min(pays_data_grouped.map(d => d[0] * step)),
                d3.max(pays_data_grouped.map(d => d[0] * step)) + 1,
                step
            ))
            .range([0, width])
            .padding(0.);
        const y = d3.scaleBand()
            .domain(d3.range(
                1,
                d3.max(pays_data_grouped.map(d => d[1].length)) + 1,
                1
            ))
            .range([height, 0])
            .padding(0.);

        // Titre
        $("#historique-titre").html(`<b3>Historique des matchs :<b3>`);

        // Données
        const g = svg_historique.selectAll("rect").data(pays_data_grouped).enter()
            .append("g")
            .attr("transform", d => `translate(${x_offset + x(d[0] * step)}, ${y_offset})`);
        
        g.selectAll("rect").data(d => d[1]).enter().append("rect")
            .attr("fill", d => color(d.result_france))
            .attr("stroke", "white")
            .attr("x", 0)
            .attr("y", (d, i) => y(i+1))
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            // Afficher des informations sur le match
            .on("mouseover", (e, d) => {
                g.selectAll("rect").attr("opacity", 0.3);
                g.selectAll("rect")
                    .filter(f => f == d)
                    .attr("opacity", 1);

                tooltip_historique.transition()
                    .duration(200)
                    .style("opacity", 1);
                // On affiche la date, la compétition et le score du match
                tooltip_historique.html("Date : " + d.date + "<br/>Compétition : " + d.competition + "<br/>Score : " + d.score1 + "-" + d.score2);
            })
            // Supprimer la tooltip
            .on("mouseout", (e, d) => {
                svg_historique.selectAll("rect").attr("opacity", 1);
                tooltip_historique.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
          
        // Axes
        // On garde 6 ticks
        var step_ticks = Math.ceil(x.domain().length / 6);
        var step_ticks = (step_ticks > 0) ? step_ticks : 1;

        const xAxis = g => g
            .attr("transform", `translate(${x_offset},${y_offset + height})`)
            .call(d3.axisBottom(x)
            .tickFormat(function(d,i) {
                if (!(i % (step_ticks))) {
                    return d;
                }
                else {
                    return "";
                }
            }));
        const yAxis = g => g
            .attr("transform", `translate(${x_offset},${y_offset})`)
            .call(d3.axisLeft(y));
      
        svg_historique.append("g").call(xAxis);
        svg_historique.append("g").call(yAxis);
    }

    function refit_global(data, json) {   
        if ($("#stats-par-pays").css("display") != "none") {
            global.style.width = "66%";
        }
        else {
            global.style.width = "100%";
        }
        // Coloration map
        map(data, json);
        // Ajouter svg stats globales
        // Nombre d'adversaires et buts pris/mis
        france_adversairs_buts(data);
        // Nombre matchs avec victoires/défaites/nuls
        win_loss(data);
        // Camembert matchs amicaux/compétitifs etc.
        pie_chart_competition(data);
    }


    function create_colorscale(n_colors) {
        var redColors = [];
        for (var i = 0; i < n_colors-1; i++) {
            redColors[i] = `rgb(255,${255 * (n_colors-(i+1))/n_colors},${255 * (n_colors-(i+1))/n_colors})`;
        } 
        redColors[n_colors-1] = "rgb(167,0,0)";
        return redColors;
    }

    // Fonctions pour parser le dataset
    parseDate = d3.utcParse('%Y-%m-%d');

    function removeAccents(str) {
        return str.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    }

});
