package cli

import "github.com/spf13/cobra"

var (
	version = "dev"
	commit  = "unknown"
)

func SetVersion(v, c string) {
	version = v
	commit = c
}

func NewRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:   "registry-browser",
		Short: "Docker Registry Browser",
		Long:  "A web-based UI for browsing Docker Registry V2 repositories, tags, and manifests.",
	}

	root.AddCommand(
		newServeCmd(),
		newVersionCmd(),
	)

	return root
}

func newVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print the version",
		Run: func(cmd *cobra.Command, _ []string) {
			cmd.Printf("registry-browser %s (%s)\n", version, commit)
		},
	}
}
