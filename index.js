$(function(){
	/* Age Pulldown */
	var now = new Date();
	var yyyymmdd = now.getFullYear()+("0"+(now.getMonth()+1)).slice(-2)+("0"+now.getDate()).slice(-2);
	var age = Math.floor((yyyymmdd-19821124)/10000);
	for(var i = 100; i > 0; i--) {
		$('select#age').append($('<option />').val(i).html(i));
	}
	$("select#age").val(age);

	$("div#edit-button").click(function() {
	  alert("sorry for you can't. the only thing you can really change is yourself.");
	});

	$("div.siimple-card").click(function() {
		window.open($(this).attr('href'),'shimizuku','');
	});
	
});