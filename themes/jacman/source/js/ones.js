$(function(){
    if(sessionStorage.getItem("ones") == null) {
        $.ajax("//wq.liexing.me/api/one", {
            type: 'post',
            data:{
                sk: "6666666666666666"
            },
            dataType: "json",
            success: function(result){
                $("#ones").html('<a href="'+ result.data.share_url + '">' + result.data.forward + "——by. " + result.data.words_info + "</a>");
                sessionStorage.setItem("ones", '<a href="'+ result.data.share_url + '">' + result.data.forward + "——by. " + result.data.words_info + "</a>");
            },
            error: function(XMLHttpRequest, textStatus, errorThrown) {
                console.error("get ones error...");
            }
        });
    } else{
        $("#ones").html(sessionStorage.getItem("ones"));
    }
});
