#define _GNU_SOURCE
#include <sys/mman.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "metaheader.h"
#ifdef LZ4
#include "lz4.h"
#endif


int main(int argc, char *argv[], char *envp[]){
	char *target_binary = NULL;
	long target_size = 0;
	long target_old_size = 0;
	char *binary_name = argv[0] + strlen(argv[0]);
	while(binary_name[0] != '/' && binary_name >= argv[0]){
		binary_name--;
	}
	binary_name++;
	
	#include "selector.c"
	
	if(!target_binary) return 0;

	#ifdef LZ4
	char* decompressed_data = malloc((size_t)target_old_size);
	const int decompressed_size = LZ4_decompress_safe(target_binary, decompressed_data, target_size, target_old_size);
	target_binary = decompressed_data;
	#endif

        int temp_fd = memfd_create("multicall",0);
	write(temp_fd,target_binary,target_old_size);
        lseek(temp_fd,0,SEEK_SET);
	fexecve(temp_fd,argv,envp);
	return 0;
}
